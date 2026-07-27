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

  const result = await prisma.$transaction(
    async (tx: any) => {
      const created = await tx.order.createMany({
        data: orders.map((order) => ({
          orderId: order.orderId,
          customerId: order.customerId,
          orderDate: order.orderDate,
          orderAmount: order.orderAmount,
          status: order.status,
        })),
        skipDuplicates: true,
      });

      return created.count;
    },
    {
      maxWait: 10000,
      timeout: 30000,
    },
  );

  logger.info("Batch insert completed", {
    batchSize: orders.length,
    insertedCount: result,
    skippedDuplicates: orders.length - result,
  });

  return result;
}

/**
 * Demonstrates which hash partition a given customer_id routes to.
 *
 * PostgreSQL uses an internal hash function for partition routing.
 * This helper queries the actual partition assignment for transparency.
 * Useful for logging, debugging, and demonstrating shard awareness.
 */
export async function getShardInfo(
  customerId: string,
): Promise<{ partition: string; partitionIndex: number }> {
  const result = await prisma.$queryRaw<
    { partition: string }[]
  >`SELECT tableoid::regclass AS partition
    FROM orders
    WHERE customer_id = ${customerId}
    LIMIT 1`;

  if (result.length === 0) {
    // If no rows exist yet, we can compute the expected partition
    // using PostgreSQL's hashtext function
    const hashResult = await prisma.$queryRaw<
      { hash_val: number }[]
    >`SELECT hashtext(${customerId}) AS hash_val`;

    const hashVal = hashResult[0].hash_val;
    // PostgreSQL uses unsigned hash modulo for partition routing
    const partitionIndex =
      ((hashVal % NUM_PARTITIONS) + NUM_PARTITIONS) % NUM_PARTITIONS;

    return {
      partition: `orders_p${partitionIndex}`,
      partitionIndex,
    };
  }

  const partition = result[0].partition;
  const partitionIndex = parseInt(partition.replace("orders_p", ""), 10);

  return { partition, partitionIndex };
}

/**
 * Returns the distribution of orders across all hash partitions.
 * Useful for verifying that data is evenly distributed.
 */
export async function getPartitionDistribution(): Promise<
  { partition: string; count: bigint }[]
> {
  const result = await prisma.$queryRaw<
    { partition: string; count: bigint }[]
  >`SELECT tableoid::regclass AS partition, COUNT(*) AS count
    FROM orders
    GROUP BY tableoid
    ORDER BY partition`;

  return result;
}
