import { Readable } from "stream";
import { parse } from "csv-parse";
import { env } from "../config/env.js";
import { validateOrderRow } from "../utils/validators.js";
import { logger } from "../utils/logger.js";
import type { ParsedOrder, InvalidRow, CSVBatch } from "../types/index.js";

export type { CSVBatch };

/**
 * Streaming CSV parser that yields batches of validated rows.
 *
 * Uses Node.js streams under the hood — the CSV is parsed row-by-row,
 * not loaded entirely into memory. Rows are accumulated into batches
 * of `batchSize` before being yielded to the caller for insertion.
 */
export async function* parseCSVStream(
  input: Buffer | Readable,
  batchSize: number = env.CSV_BATCH_SIZE,
): AsyncGenerator<CSVBatch> {
  const stream = Buffer.isBuffer(input) ? Readable.from(input) : input;

  const parser = stream.pipe(
    parse({
      columns: true, // Use first row as headers
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true, // Handle rows with inconsistent column counts
    }),
  );

  let currentBatch: ParsedOrder[] = [];
  let currentInvalid: InvalidRow[] = [];
  let rowNumber = 1; // 1-indexed (header is row 0)

  for await (const row of parser) {
    rowNumber++;

    const result = validateOrderRow(row as Record<string, string>, rowNumber);

    if (result.valid && result.data) {
      currentBatch.push(result.data);
    } else {
      currentInvalid.push({
        rowNumber,
        rawData: row as Record<string, string>,
        errors: result.errors,
      });

      logger.warn("Invalid CSV row", {
        rowNumber,
        errors: result.errors,
      });
    }

    // Yield when batch is full
    if (currentBatch.length >= batchSize) {
      yield {
        validOrders: currentBatch,
        invalidRows: currentInvalid,
      };
      currentBatch = [];
      currentInvalid = [];
    }
  }

  // Yield remaining rows
  if (currentBatch.length > 0 || currentInvalid.length > 0) {
    yield {
      validOrders: currentBatch,
      invalidRows: currentInvalid,
    };
  }

  logger.info("CSV parsing completed", { totalRowsParsed: rowNumber - 1 });
}
