import multer from "multer";
import type { Request } from "express";
import {
  MAX_UPLOAD_FILE_SIZE_BYTES,
  ALLOWED_CSV_MIME_TYPES,
  ALLOWED_CSV_EXTENSIONS,
} from "../constants/orders.constants.js";

/**
 * Multer configuration for file uploads.
 *
 * Uses memory storage to keep the file as a Buffer — this lets us
 * stream the same buffer to both GCS upload and CSV parsing concurrently.
 *
 * File size limit: 50MB (generous for ~10K row CSVs).
 */
const storage = multer.memoryStorage();

function csvFileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void {
  const extension = file.originalname
    .toLowerCase()
    .substring(file.originalname.lastIndexOf("."));

  if (
    (ALLOWED_CSV_MIME_TYPES as readonly string[]).includes(file.mimetype) ||
    (ALLOWED_CSV_EXTENSIONS as readonly string[]).includes(extension)
  ) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type: ${file.mimetype}. Only CSV files are accepted.`,
      ),
    );
  }
}

export const upload = multer({
  storage,
  limits: {
    fileSize: MAX_UPLOAD_FILE_SIZE_BYTES,
  },
  fileFilter: csvFileFilter,
});
