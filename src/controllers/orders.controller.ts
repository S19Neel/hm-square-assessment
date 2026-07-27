import type { Request, Response } from "express";
import { uploadFileToGCS } from "../services/gcs.service.js";
import { parseCSVStream } from "../services/csv-parser.service.js";
import { insertOrderBatch } from "../services/orders.service.js";
import { logger } from "../utils/logger.js";
import { AppError } from "../middleware/error.middleware.js";
import type { InvalidRow } from "../utils/validators.js";

const MAX_ERRORS_IN_RESPONSE = 100;

/**
 * POST /upload-orders
 *
 * Orchestrates the full upload flow:
 * 1. Validate uploaded file
 * 2. Upload to GCS (concurrently with parsing)
 * 3. Stream-parse CSV and batch insert into PostgreSQL
 * 4. Return summary response
 */
export async function uploadOrders(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();

  try {
    const file = req.file;
    if (!file) {
      throw new AppError(
        "No file uploaded. Send a CSV file in the 'file' field.",
        400,
      );
    }

    logger.info("Order upload started", {
      filename: file.originalname,
      sizeBytes: file.size,
      mimetype: file.mimetype,
    });

    const gcsUploadPromise = uploadFileToGCS(file.buffer, file.originalname);

    let totalRows = 0;
    let insertedRows = 0;
    const allInvalidRows: InvalidRow[] = [];
    let batchNumber = 0;

    for await (const batch of parseCSVStream(file.buffer)) {
      batchNumber++;
      totalRows += batch.validOrders.length + batch.invalidRows.length;

      if (batch.validOrders.length > 0) {
        const inserted = await insertOrderBatch(batch.validOrders);
        insertedRows += inserted;

        logger.info("Batch processed", {
          batchNumber,
          validInBatch: batch.validOrders.length,
          insertedInBatch: inserted,
        });
      }

      if (allInvalidRows.length < MAX_ERRORS_IN_RESPONSE) {
        allInvalidRows.push(
          ...batch.invalidRows.slice(
            0,
            MAX_ERRORS_IN_RESPONSE - allInvalidRows.length,
          ),
        );
      }
    }

    const gcsResult = await gcsUploadPromise;
    const processingTimeMs = Date.now() - startTime;

    logger.info("Order upload completed", {
      filename: file.originalname,
      totalRows,
      insertedRows,
      skippedRows: totalRows - insertedRows,
      processingTimeMs,
      gcsUri: gcsResult.gcsUri,
    });

    res.status(200).json({
      success: true,
      gcsUri: gcsResult.gcsUri,
      summary: {
        totalRows,
        insertedRows,
        skippedRows: totalRows - insertedRows,
        processingTimeMs,
      },
      errors:
        allInvalidRows.length > 0
          ? {
              count: allInvalidRows.length,
              samples: allInvalidRows.map((row) => ({
                row: row.rowNumber,
                errors: row.errors,
                data: row.rawData,
              })),
            }
          : null,
    });
  } catch (error) {
    const processingTimeMs = Date.now() - startTime;

    logger.error("Order upload failed", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      processingTimeMs,
    });

    res.status(500).json({
      success: false,
      error: "Failed to process orders file",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
