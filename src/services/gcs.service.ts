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
  buffer: Buffer,
  originalFilename: string,
): Promise<GCSUploadResult> {
  const timestamp = Date.now();
  const sanitizedName = originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const destination = `orders/${timestamp}_${sanitizedName}`;

  logger.info("GCS upload started", {
    bucket: env.GCS_BUCKET_NAME,
    destination,
    sizeBytes: buffer.length,
  });

  const file = bucket.file(destination);

  await file.save(buffer, {
    resumable: false, // Not needed for files under 10MB typically
    contentType: "text/csv",
    metadata: {
      metadata: {
        uploadedAt: new Date().toISOString(),
        originalFilename,
      },
    },
  });

  const gcsUri = `gs://${env.GCS_BUCKET_NAME}/${destination}`;
  const publicUrl = `https://storage.googleapis.com/${env.GCS_BUCKET_NAME}/${destination}`;

  logger.info("GCS upload completed", { gcsUri, destination });

  return { gcsUri, publicUrl, filename: destination };
}
