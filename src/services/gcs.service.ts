import { Readable } from "stream";
import { Storage } from "@google-cloud/storage";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

const storage = new Storage();
const bucket = storage.bucket(env.GCS_BUCKET_NAME);

export interface GCSUploadResult {
  gcsUri: string;
  publicUrl: string;
  filename: string;
}

/**
 * Uploads a file buffer to Google Cloud Storage.
 * Organizes files under: orders/{timestamp}_{originalFilename}
 */
export async function uploadFileToGCS(
  input: Buffer | Readable,
  originalFilename: string,
): Promise<GCSUploadResult> {
  const timestamp = Date.now();
  const sanitizedName = originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const destination = `orders/${timestamp}_${sanitizedName}`;

  logger.info("GCS upload started", {
    bucket: env.GCS_BUCKET_NAME,
    destination,
    isBuffer: Buffer.isBuffer(input),
  });

  const file = bucket.file(destination);

  if (Buffer.isBuffer(input)) {
    await file.save(input, {
      resumable: false,
      contentType: "text/csv",
      metadata: {
        metadata: {
          uploadedAt: new Date().toISOString(),
          originalFilename,
        },
      },
    });
  } else {
    await new Promise<void>((resolve, reject) => {
      const writeStream = file.createWriteStream({
        resumable: false,
        contentType: "text/csv",
        metadata: {
          metadata: {
            uploadedAt: new Date().toISOString(),
            originalFilename,
          },
        },
      });

      input.pipe(writeStream).on("error", reject).on("finish", resolve);
    });
  }

  const gcsUri = `gs://${env.GCS_BUCKET_NAME}/${destination}`;
  const publicUrl = `https://storage.googleapis.com/${env.GCS_BUCKET_NAME}/${destination}`;

  logger.info("GCS upload completed", { gcsUri, destination });

  return { gcsUri, publicUrl, filename: destination };
}
