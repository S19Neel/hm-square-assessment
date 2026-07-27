import multer from "multer";
import type { Request } from "express";

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
  cb: multer.FileFilterCallback
): void {
  const allowedMimes = ["text/csv", "application/vnd.ms-excel"];
  const allowedExtensions = [".csv"];

  const extension = file.originalname
    .toLowerCase()
    .substring(file.originalname.lastIndexOf("."));

  if (
    allowedMimes.includes(file.mimetype) ||
    allowedExtensions.includes(extension)
  ) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type: ${file.mimetype}. Only CSV files are accepted.`
      )
    );
  }
}

export const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: csvFileFilter,
});
