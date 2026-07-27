export type JobStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface UploadJobStatus {
  uploadId: string;
  originalFilename: string;
  gcsUri: string;
  status: JobStatus;
  totalRows: number;
  insertedRows: number;
  failedRows: number;
  processingTimeMs?: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  operationName?: string;
}
