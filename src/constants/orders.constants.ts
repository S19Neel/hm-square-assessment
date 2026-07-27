export const NUM_PARTITIONS = 4;
export const MAX_ERRORS_IN_RESPONSE = 100;

export const ALLOWED_STATUSES = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "completed",
  "returned",
  "refunded",
] as const;

export const MAX_UPLOAD_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export const ALLOWED_CSV_MIME_TYPES = [
  "text/csv",
  "application/vnd.ms-excel",
] as const;

export const ALLOWED_CSV_EXTENSIONS = [".csv"] as const;
