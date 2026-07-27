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
];

/**
 * Validates a single CSV row and returns a typed ParsedOrder if valid.
 * Normalizes field names to handle common CSV header variations.
 */
export function validateOrderRow(
  row: Record<string, string>,
  rowNumber: number,
): ValidationResult {
  const errors: string[] = [];

  // Normalize keys to handle header variations (e.g., "Order ID", "order_id", "orderId")
  const normalized = normalizeRow(row);

  // --- order_id ---
  const orderId = normalized.order_id?.trim();
  if (!orderId) {
    errors.push("order_id is required");
  }

  // --- customer_id ---
  const customerId = normalized.customer_id?.trim();
  if (!customerId) {
    errors.push("customer_id is required");
  }

  // --- order_date ---
  const rawDate = normalized.order_date?.trim();
  let orderDate: Date | undefined;
  if (!rawDate) {
    errors.push("order_date is required");
  } else {
    orderDate = new Date(rawDate);
    if (isNaN(orderDate.getTime())) {
      errors.push(`order_date is not a valid date: "${rawDate}"`);
    }
  }

  // --- order_amount ---
  const rawAmount = normalized.order_amount?.trim();
  let orderAmount: number | undefined;
  if (!rawAmount) {
    errors.push("order_amount is required");
  } else {
    orderAmount = parseFloat(rawAmount);
    if (isNaN(orderAmount)) {
      errors.push(`order_amount is not a valid number: "${rawAmount}"`);
    } else if (orderAmount < 0) {
      errors.push(`order_amount must be non-negative: ${orderAmount}`);
    }
  }

  // --- status ---
  const status = normalized.status?.trim().toLowerCase();
  if (!status) {
    errors.push("status is required");
  } else if (!ALLOWED_STATUSES.includes(status)) {
    errors.push(
      `status "${status}" is not valid. Allowed: ${ALLOWED_STATUSES.join(", ")}`,
    );
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    data: {
      orderId: orderId!,
      customerId: customerId!,
      orderDate: orderDate!,
      orderAmount: orderAmount!,
      status: status!,
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
