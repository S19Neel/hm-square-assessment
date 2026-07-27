import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app.js";
import { prisma } from "../../config/database.js";

vi.mock("../../config/database.js", () => ({
  prisma: {
    order: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      createMany: vi.fn(),
    },
    orderError: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      count: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
  connectDatabase: vi.fn().mockResolvedValue(undefined),
  disconnectDatabase: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
}));

vi.mock("../../services/gcs.service.js", () => ({
  uploadFileToGCS: vi.fn().mockResolvedValue({
    gcsUri: "gs://test-bucket/orders/123_test.csv",
    publicUrl: "https://storage.googleapis.com/test-bucket/orders/123_test.csv",
    filename: "orders/123_test.csv",
  }),
}));

describe("Orders Routes Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /upload-orders", () => {
    it("should return 400 when no file is attached", async () => {
      const response = await request(app).post("/upload-orders");

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("No file uploaded");
    });

    it("should process attached CSV file and return summary with exact response structure", async () => {
      vi.mocked(prisma.order.createMany).mockResolvedValueOnce({ count: 2 });

      const csvBuffer = Buffer.from(
        "order_id,customer_id,order_date,order_amount,status\n" +
          "ORD-101,CUST-01,2026-07-20,100.50,completed\n" +
          "ORD-102,CUST-02,2026-07-21,250.00,pending\n",
      );

      const response = await request(app)
        .post("/upload-orders")
        .attach("file", csvBuffer, "test-orders.csv");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.uploadId).toBeDefined();
      expect(response.body.gcsUri).toContain("gs://");
      expect(response.body.summary).toEqual({
        totalRows: 2,
        insertedRows: 2,
        failedRows: 0,
        skippedRows: 0,
        processingTimeMs: expect.any(Number),
      });
      expect(response.body.errors).toBeNull();
    });
  });

  describe("GET /orders/:orderId", () => {
    it("should return 404 if order does not exist", async () => {
      vi.mocked(prisma.order.findFirst).mockResolvedValueOnce(null);

      const response = await request(app).get("/orders/ORD-NONEXISTENT");

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("not found");
    });

    it("should return order object and shardInfo if order exists", async () => {
      const mockOrder = {
        id: "a1b2c3d4-e5f6-7890-abcd-1234567890ab",
        orderId: "ORD-101",
        customerId: "CUST-01",
        orderDate: "2026-07-20T00:00:00.000Z",
        orderAmount: "100.50",
        status: "completed",
        createdAt: "2026-07-27T18:00:00.000Z",
      };

      vi.mocked(prisma.order.findFirst).mockResolvedValueOnce(mockOrder as any);
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
        { partition: "orders_p0" },
      ]);

      const response = await request(app).get("/orders/ORD-101");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.orderId).toBe("ORD-101");
      expect(response.body.data.shardInfo.partition).toBe("orders_p0");
    });
  });

  describe("GET /orders", () => {
    it("should return paginated list of orders", async () => {
      const mockOrders = [
        {
          id: "1",
          orderId: "ORD-101",
          customerId: "CUST-01",
          orderDate: "2026-07-20T00:00:00.000Z",
          orderAmount: "100.50",
          status: "completed",
        },
      ];

      vi.mocked(prisma.order.count).mockResolvedValueOnce(1);
      vi.mocked(prisma.order.findMany).mockResolvedValueOnce(mockOrders as any);

      const response = await request(app).get("/orders");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.orders.length).toBe(1);
      expect(response.body.pagination.total).toBe(1);
    });

    it("should filter by customerId and include shardInfo", async () => {
      vi.mocked(prisma.order.count).mockResolvedValueOnce(1);
      vi.mocked(prisma.order.findMany).mockResolvedValueOnce([] as any);
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
        { partition: "orders_p1" },
      ]);

      const response = await request(app).get("/orders?customerId=CUST-01");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.shardInfo.partition).toBe("orders_p1");
    });
  });

  describe("GET /orders/errors/:uploadId", () => {
    it("should return error records for given uploadId", async () => {
      const mockErrors = [
        {
          id: "err-1",
          uploadId: "upload-abc-123",
          rowNumber: 2,
          rawData: { order_id: "" },
          errors: ["order_id is required"],
          createdAt: "2026-07-27T18:00:00.000Z",
        },
      ];

      vi.mocked(prisma.orderError.findMany).mockResolvedValueOnce(mockErrors as any);

      const response = await request(app).get(
        "/orders/errors/upload-abc-123",
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.uploadId).toBe("upload-abc-123");
      expect(response.body.totalErrors).toBe(1);
      expect(response.body.errors[0].rowNumber).toBe(2);
    });
  });
});
