import { describe, it, expect } from "vitest";
import { validateOrderRow } from "../validators.js";

describe("validateOrderRow", () => {
  it("should successfully validate a valid order row with standard headers", () => {
    const row = {
      order_id: "ORD-1001",
      customer_id: "CUST-500",
      order_date: "2026-07-27T10:00:00Z",
      order_amount: "150.50",
      status: "completed",
    };

    const result = validateOrderRow(row, 2);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.data).toBeDefined();
    expect(result.data?.orderId).toBe("ORD-1001");
    expect(result.data?.customerId).toBe("CUST-500");
    expect(result.data?.orderAmount).toBe(150.5);
    expect(result.data?.status).toBe("completed");
    expect(result.data?.orderDate).toBeInstanceOf(Date);
  });

  it("should normalize camelCase and spaced header keys", () => {
    const row = {
      "Order ID": "ORD-1002",
      customerId: "CUST-501",
      "Order Date": "2026-07-27",
      "Order-Amount": "99.99",
      Status: "PENDING",
    };

    const result = validateOrderRow(row, 3);
    expect(result.valid).toBe(true);
    expect(result.data?.orderId).toBe("ORD-1002");
    expect(result.data?.customerId).toBe("CUST-501");
    expect(result.data?.status).toBe("pending");
  });

  it("should return errors for missing required fields", () => {
    const row = {
      order_id: "",
      customer_id: "  ",
      order_date: "",
      order_amount: "",
      status: "",
    };

    const result = validateOrderRow(row, 4);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });

  it("should fail validation for invalid date, negative amount, and unknown status", () => {
    const row = {
      order_id: "ORD-1003",
      customer_id: "CUST-502",
      order_date: "invalid-date-string",
      order_amount: "-50.00",
      status: "unknown_status",
    };

    const result = validateOrderRow(row, 5);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'order_date is not a valid date: "invalid-date-string"',
    );
    expect(result.errors).toContain("order_amount must be non-negative: -50");
    expect(
      result.errors.some((e) =>
        e.includes('status "unknown_status" is not valid'),
      ),
    ).toBe(true);
  });
});
