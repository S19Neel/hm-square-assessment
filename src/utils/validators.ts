import { orderRowSchema } from "../validations/orders.validation.js";
import type {
  ValidationResult,
  ParsedOrder,
  InvalidRow,
} from "../types/orders.types.js";

export type { ParsedOrder, ValidationResult, InvalidRow };

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
export function normalizeRow(
  row: Record<string, string>,
): Record<string, string> {
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
