import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import { MAX_ERRORS_IN_RESPONSE } from "../constants/index.js";
import { getOrdersQuerySchema } from "../validations/index.js";
import { uploadFileToGCS } from "../services/gcs.service.js";
import { parseCSVStream } from "../services/csv-parser.service.js";
import {
  insertOrderBatch,
  insertOrderErrors,
  findOrderByOrderId,
  findOrdersByCustomerId,
  findErrorsByUploadId,
} from "../services/orders.service.js";
import { withRetry } from "../utils/retry.js";
import { logger } from "../utils/logger.js";
import { AppError } from "../middleware/error.middleware.js";

interface SampleError {
  row: number;
  errors: string[];
  data: Record<string, string>;
}

/**
 * POST /upload-orders
 *
 * Orchestrates the full upload flow:
 * 1. Validate uploaded file
 * 2. Upload file to GCS via ADC (with retry logic)
 * 3. Stream-parse CSV and batch insert into PostgreSQL (hash-partitioned)
 * 4. Persist malformed/invalid rows to OrderError table
 * 5. Return processing summary and error details
 */
export async function uploadOrders(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  const uploadId = randomUUID();

  try {
    const file = req.file;
    if (!file) {
      throw new AppError(
        "No file uploaded. Send a CSV file in the 'file' field.",
        400,
      );
    }

    logger.info("Order upload started", {
      uploadId,
      filename: file.originalname,
      sizeBytes: file.size,
      mimetype: file.mimetype,
    });

    // Upload to GCS concurrently with automatic retry logic
    const gcsUploadPromise = withRetry(
      () => uploadFileToGCS(file.buffer, file.originalname),
      { operationName: "GCSUpload" },
    );

    let totalRows = 0;
    let insertedRows = 0;
    let totalFailedRows = 0;
    const sampleErrors: SampleError[] = [];
    let batchNumber = 0;

    for await (const batch of parseCSVStream(file.buffer)) {
      batchNumber++;
      totalRows += batch.validOrders.length + batch.invalidRows.length;

      if (batch.validOrders.length > 0) {
        const inserted = await withRetry(
          () => insertOrderBatch(batch.validOrders),
          { operationName: `BatchInsert-${batchNumber}` },
        );
        insertedRows += inserted;

        logger.info("Batch processed", {
          uploadId,
          batchNumber,
          validInBatch: batch.validOrders.length,
          insertedInBatch: inserted,
        });
      }

      if (batch.invalidRows.length > 0) {
        totalFailedRows += batch.invalidRows.length;

        for (const row of batch.invalidRows) {
          if (sampleErrors.length < MAX_ERRORS_IN_RESPONSE) {
            sampleErrors.push({
              row: row.rowNumber,
              errors: row.errors,
              data: row.rawData,
            });
          }
        }

        await withRetry(
          () => insertOrderErrors(uploadId, batch.invalidRows),
          { operationName: `ErrorInsert-${batchNumber}` },
        );
      }
    }

    const gcsResult = await gcsUploadPromise;
    const processingTimeMs = Date.now() - startTime;

    logger.info("Order upload completed", {
      uploadId,
      filename: file.originalname,
      totalRows,
      insertedRows,
      skippedRows: totalRows - insertedRows,
      processingTimeMs,
      gcsUri: gcsResult.gcsUri,
    });

    res.status(200).json({
      success: true,
      uploadId,
      gcsUri: gcsResult.gcsUri,
      summary: {
        totalRows,
        insertedRows,
        failedRows: totalFailedRows,
        skippedRows: totalRows - insertedRows,
        processingTimeMs,
      },
      errors:
        totalFailedRows > 0
          ? {
              totalFailed: totalFailedRows,
              sampleCount: sampleErrors.length,
              samples: sampleErrors,
            }
          : null,
    });
  } catch (error) {
    const processingTimeMs = Date.now() - startTime;

    logger.error("Order upload failed", {
      uploadId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      processingTimeMs,
    });

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      `Failed to process orders file: ${error instanceof Error ? error.message : "Unknown error"}`,
      500,
    );
  }
}

/**
 * GET /orders/:orderId
 *
 * Retrieves a single order by orderId, including partition metadata.
 */
export async function getOrderById(req: Request, res: Response): Promise<void> {
  const orderId = Array.isArray(req.params.orderId)
    ? req.params.orderId[0]
    : req.params.orderId;

  if (!orderId) {
    throw new AppError("Order ID is required", 400);
  }

  const order = await findOrderByOrderId(orderId);

  if (!order) {
    throw new AppError(`Order with ID '${orderId}' not found`, 404);
  }

  res.status(200).json({
    success: true,
    data: order,
  });
}

/**
 * GET /orders?customerId=...&status=...&page=...&limit=...
 *
 * Retrieves paginated orders for a customer with optional status filtering.
 */
export async function getOrdersByCustomer(
  req: Request,
  res: Response,
): Promise<void> {
  const parsed = getOrdersQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    const issueMessages = parsed.error.issues.map((i) => i.message).join(", ");
    throw new AppError(`Invalid query parameters: ${issueMessages}`, 400);
  }

  const result = await findOrdersByCustomerId(parsed.data);

  res.status(200).json({
    success: true,
    ...result,
  });
}

/**
 * GET /orders/errors/:uploadId
 *
 * Retrieves all persisted error records for a specific upload attempt.
 */
export async function getUploadErrors(
  req: Request,
  res: Response,
): Promise<void> {
  const uploadId = Array.isArray(req.params.uploadId)
    ? req.params.uploadId[0]
    : req.params.uploadId;

  if (!uploadId) {
    throw new AppError("Upload ID is required", 400);
  }

  const errors = await findErrorsByUploadId(uploadId);

  res.status(200).json({
    success: true,
    uploadId,
    totalErrors: errors.length,
    errors: errors.map((e) => ({
      rowNumber: e.rowNumber,
      rawData: e.rawData,
      errors: e.errors,
      createdAt: e.createdAt,
    })),
  });
}
