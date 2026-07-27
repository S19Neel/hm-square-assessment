import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  findOrderByOrderId,
  findOrdersByCustomerId,
  findErrorsByUploadId,
  getShardInfo,
} from "../orders.service.js";
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
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("orders.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getShardInfo", () => {
    it("should return expected partition based on fallback hash calculation when DB query yields no results", async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([]);

      const shardInfo = await getShardInfo("CUST-100");

      expect(shardInfo).toHaveProperty("partition");
      expect(shardInfo.partition).toMatch(/^orders_p[0-3]$/);
      expect(shardInfo.partitionIndex).toBeGreaterThanOrEqual(0);
      expect(shardInfo.partitionIndex).toBeLessThanOrEqual(3);
    });

    it("should return partition from raw SQL when row exists", async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
        { partition: "orders_p2" },
      ]);

      const shardInfo = await getShardInfo("CUST-100");

      expect(shardInfo.partition).toBe("orders_p2");
      expect(shardInfo.partitionIndex).toBe(2);
    });
  });

  describe("findOrderByOrderId", () => {
    it("should return null if order does not exist", async () => {
      vi.mocked(prisma.order.findFirst).mockResolvedValueOnce(null);

      const result = await findOrderByOrderId("ORD-99999");

      expect(result).toBeNull();
      expect(prisma.order.findFirst).toHaveBeenCalledWith({
        where: { orderId: "ORD-99999" },
      });
    });

    it("should return order object along with shardInfo if found", async () => {
      const mockOrder = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        orderId: "ORD-10001",
        customerId: "CUST-001",
        orderDate: new Date("2026-07-20"),
        orderAmount: 199.99,
        status: "pending",
        createdAt: new Date(),
      };

      vi.mocked(prisma.order.findFirst).mockResolvedValueOnce(mockOrder as any);
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
        { partition: "orders_p1" },
      ]);

      const result = await findOrderByOrderId("ORD-10001");

      expect(result).not.toBeNull();
      expect(result?.orderId).toBe("ORD-10001");
      expect(result?.shardInfo.partition).toBe("orders_p1");
    });
  });

  describe("findOrdersByCustomerId", () => {
    it("should return paginated result with metadata", async () => {
      const mockOrders = [
        {
          id: "1",
          orderId: "ORD-001",
          customerId: "CUST-001",
          orderDate: new Date(),
          orderAmount: 100,
          status: "pending",
          createdAt: new Date(),
        },
      ];

      vi.mocked(prisma.order.count).mockResolvedValueOnce(1);
      vi.mocked(prisma.order.findMany).mockResolvedValueOnce(mockOrders as any);
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
        { partition: "orders_p0" },
      ]);

      const result = await findOrdersByCustomerId({
        customerId: "CUST-001",
        page: 1,
        limit: 10,
      });

      expect(result.orders.length).toBe(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
      expect(result.pagination.hasNext).toBe(false);
      expect(result.pagination.hasPrev).toBe(false);
    });
  });

  describe("findErrorsByUploadId", () => {
    it("should query orderError table by uploadId", async () => {
      const mockErrors = [
        {
          id: "err-1",
          uploadId: "upl-123",
          rowNumber: 5,
          rawData: { order_id: "BAD" },
          errors: ["invalid status"],
          createdAt: new Date(),
        },
      ];

      vi.mocked((prisma as any).orderError.findMany).mockResolvedValueOnce(
        mockErrors as any,
      );

      const errors = await findErrorsByUploadId("upl-123");

      expect(errors.length).toBe(1);
      expect(errors[0].rowNumber).toBe(5);
      expect((prisma as any).orderError.findMany).toHaveBeenCalledWith({
        where: { uploadId: "upl-123" },
        orderBy: { rowNumber: "asc" },
      });
    });
  });
});
