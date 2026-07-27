import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";
import type { ParsedOrder } from "../utils/validators.js";

const NUM_PARTITIONS = 4;

/**
 * Batch-inserts validated orders into PostgreSQL using Prisma's createMany.
 * Each batch is wrapped in a transaction for atomicity.
 *
 * PostgreSQL automatically routes each row to the correct hash partition
 * based on the customer_id value — no application-level routing needed.
 */
export async function insertOrderBatch(orders: ParsedOrder[]): Promise<number> {
  if (orders.length === 0) return 0;

  const created = await prisma.order.createMany({
    data: orders.map((order) => ({
      orderId: order.orderId,
      customerId: order.customerId,
      orderDate: order.orderDate,
      orderAmount: order.orderAmount,
      status: order.status,
    })),
    skipDuplicates: true,
  });

  const insertedCount = created.count;

  logger.info("Batch insert completed", {
    batchSize: orders.length,
    insertedCount,
    skippedDuplicates: orders.length - insertedCount,
  });

  return insertedCount;
}
