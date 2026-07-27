import { z } from "zod";

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

const ALLOWED_STATUSES = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "completed",
  "returned",
  "refunded",
] as const;

const orderRowSchema = z.object({
  order_id: z.string().min(1, "order_id is required"),
  customer_id: z.string().min(1, "customer_id is required"),
  order_date: z
    .string()
    .min(1, "order_date is required")
    .transform((val, ctx) => {
      const d = new Date(val);
      if (isNaN(d.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `order_date is not a valid date: "${val}"`,
        });
        return z.NEVER;
      }
      return d;
    }),
  order_amount: z
    .string()
    .min(1, "order_amount is required")
    .transform((val, ctx) => {
      const num = parseFloat(val);
      if (isNaN(num)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `order_amount is not a valid number: "${val}"`,
        });
        return z.NEVER;
      }
      if (num < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `order_amount must be non-negative: ${num}`,
        });
        return z.NEVER;
      }
      return num;
    }),
  status: z
    .string()
    .min(1, "status is required")
    .transform((val) => val.toLowerCase())
    .superRefine((val, ctx) => {
      if (
        !ALLOWED_STATUSES.includes(val as (typeof ALLOWED_STATUSES)[number])
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `status "${val}" is not valid. Allowed: ${ALLOWED_STATUSES.join(", ")}`,
        });
      }
    }),
});

/**
 * Validates a single CSV row and returns a typed ParsedOrder if valid.
 * Normalizes field names to handle common CSV header variations.
 */
export function validateOrderRow(
  row: Record<string, string>,
  _rowNumber: number,
): ValidationResult {
  const normalized = normalizeRow(row);
  const parsed = orderRowSchema.safeParse(normalized);

  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) => issue.message);
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    data: {
      orderId: parsed.data.order_id,
      customerId: parsed.data.customer_id,
      orderDate: parsed.data.order_date,
      orderAmount: parsed.data.order_amount,
      status: parsed.data.status,
    },
  };
}

/**
 * Normalizes CSV row keys to snake_case for consistent access.
 * Handles variations like "Order ID", "orderId", "order-id" → "order_id"
 */
function normalizeRow(row: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = key
      .trim()
      .replace(/([a-z])([A-Z])/g, "$1_$2") // camelCase → snake_case
      .replace(/[\s-]+/g, "_") // spaces and hyphens → underscore
      .toLowerCase();

    normalized[normalizedKey] = value;
  }

  return normalized;
}
