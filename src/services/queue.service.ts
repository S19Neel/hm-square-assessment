import { parseCSVStream } from "./csv-parser.service.js";
import { insertOrderBatch, insertOrderErrors } from "./orders.service.js";
import { withRetry } from "../utils/retry.js";
import { logger } from "../utils/logger.js";
import type { UploadJobStatus } from "../types/index.js";

interface InternalJob extends UploadJobStatus {
  buffer: Buffer;
}

const jobsMap = new Map<string, InternalJob>();

/**
 * Creates and registers a new background upload job.
 */
export function createUploadJob(
  uploadId: string,
  originalFilename: string,
  buffer: Buffer,
  gcsUri: string,
): UploadJobStatus {
  const now = new Date();
  const job: InternalJob = {
    uploadId,
    originalFilename,
    buffer,
    gcsUri,
    status: "PENDING",
    totalRows: 0,
    insertedRows: 0,
    failedRows: 0,
    createdAt: now,
    updatedAt: now,
  };

  jobsMap.set(uploadId, job);
  return getJobStatus(uploadId)!;
}

/**
 * Retrieves public progress status of a job by uploadId.
 */
export function getJobStatus(uploadId: string): UploadJobStatus | null {
  const job = jobsMap.get(uploadId);
  if (!job) return null;

  const { buffer: _, ...publicStatus } = job;
  return publicStatus;
}

/**
 * Processes an enqueued upload job asynchronously in the background.
 */
export async function processUploadJobInBackground(
  uploadId: string,
): Promise<void> {
  const job = jobsMap.get(uploadId);
  if (!job) return;

  const startTime = Date.now();
  job.status = "PROCESSING";
  job.updatedAt = new Date();

  logger.info("Background job processing started", {
    uploadId,
    filename: job.originalFilename,
  });

  try {
    let totalRows = 0;
    let insertedRows = 0;
    let failedRows = 0;
    let batchNumber = 0;

    for await (const batch of parseCSVStream(job.buffer)) {
      batchNumber++;
      totalRows += batch.validOrders.length + batch.invalidRows.length;

      // Insert valid orders with automatic retries on transient DB errors
      if (batch.validOrders.length > 0) {
        const inserted = await withRetry(
          () => insertOrderBatch(batch.validOrders),
          { operationName: `BatchInsert-${batchNumber}` },
        );
        insertedRows += inserted;
      }

      // Persist invalid rows into OrderError table with retries
      if (batch.invalidRows.length > 0) {
        failedRows += batch.invalidRows.length;
        await withRetry(() => insertOrderErrors(uploadId, batch.invalidRows), {
          operationName: `ErrorInsert-${batchNumber}`,
        });
      }

      job.totalRows = totalRows;
      job.insertedRows = insertedRows;
      job.failedRows = failedRows;
      job.updatedAt = new Date();
    }

    job.status = "COMPLETED";
    job.processingTimeMs = Date.now() - startTime;
    job.updatedAt = new Date();

    logger.info("Background job processing completed successfully", {
      uploadId,
      totalRows,
      insertedRows,
      failedRows,
      processingTimeMs: job.processingTimeMs,
    });
  } catch (error) {
    job.status = "FAILED";
    job.error = error instanceof Error ? error.message : String(error);
    job.processingTimeMs = Date.now() - startTime;
    job.updatedAt = new Date();

    logger.error("Background job processing failed", {
      uploadId,
      error: job.error,
      processingTimeMs: job.processingTimeMs,
    });
  }
}
