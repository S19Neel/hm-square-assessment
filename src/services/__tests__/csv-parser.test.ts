import { describe, it, expect } from "vitest";
import { parseCSVStream } from "../csv-parser.service.js";
import { Readable } from "stream";

describe("parseCSVStream", () => {
  it("should stream and parse valid CSV rows in batches", async () => {
    const csvContent = [
      "order_id,customer_id,order_date,order_amount,status",
      "ORD-001,CUST-100,2026-07-01,100.00,completed",
      "ORD-002,CUST-101,2026-07-02,250.50,shipped",
      "ORD-003,CUST-102,2026-07-03,45.00,pending",
    ].join("\n");

    const buffer = Buffer.from(csvContent);
    const batches = [];

    for await (const batch of parseCSVStream(buffer, 2)) {
      batches.push(batch);
    }

    expect(batches.length).toBe(2); // 2 rows in batch 1, 1 row in batch 2
    expect(batches[0].validOrders.length).toBe(2);
    expect(batches[1].validOrders.length).toBe(1);
    expect(batches[0].validOrders[0].orderId).toBe("ORD-001");
    expect(batches[1].validOrders[0].orderId).toBe("ORD-003");
  });

  it("should categorize invalid rows separately", async () => {
    const csvContent = [
      "order_id,customer_id,order_date,order_amount,status",
      "ORD-001,CUST-100,2026-07-01,100.00,completed",
      "INVALID_ROW,CUST-101,bad-date,-10,invalid_status",
    ].join("\n");

    const stream = Readable.from(Buffer.from(csvContent));
    const batches = [];

    for await (const batch of parseCSVStream(stream, 10)) {
      batches.push(batch);
    }

    expect(batches.length).toBe(1);
    expect(batches[0].validOrders.length).toBe(1);
    expect(batches[0].invalidRows.length).toBe(1);
    expect(batches[0].invalidRows[0].rowNumber).toBe(3);
    expect(batches[0].invalidRows[0].errors.length).toBeGreaterThan(0);
  });
});
