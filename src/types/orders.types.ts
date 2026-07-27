import type { ALLOWED_STATUSES } from "../constants/orders.constants.js";

export type OrderStatus = (typeof ALLOWED_STATUSES)[number];

export interface ParsedOrder {
  orderId: string;
  customerId: string;
  orderDate: Date;
  orderAmount: number;
  status: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  data?: ParsedOrder;
}

export interface InvalidRow {
  rowNumber: number;
  rawData: Record<string, string>;
  errors: string[];
}

export interface CSVBatch {
  validOrders: ParsedOrder[];
  invalidRows: InvalidRow[];
}

export interface QueryOrdersParams {
  customerId?: string;
  status?: string;
  page: number;
  limit: number;
}

export interface ShardMetadata {
  partition: string;
  partitionIndex: number;
}

export interface UploadSummary {
  totalRows: number;
  insertedRows: number;
  failedRows: number;
  skippedRows: number;
  processingTimeMs: number;
}
