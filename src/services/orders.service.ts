import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";
import type { ParsedOrder, InvalidRow } from "../utils/validators.js";

const NUM_PARTITIONS = 4;

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

/**
 * Batch-inserts validated orders into PostgreSQL using Prisma's createMany.
 * PostgreSQL automatically routes each row to the correct hash partition
 * based on customer_id.
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

/**
 * Batch inserts invalid/malformed rows into the OrderError table.
 */
export async function insertOrderErrors(
  uploadId: string,
  invalidRows: InvalidRow[],
): Promise<number> {
  if (invalidRows.length === 0) return 0;

  const created = await (prisma as any).orderError.createMany({
    data: invalidRows.map((row) => ({
      uploadId,
      rowNumber: row.rowNumber,
      rawData: row.rawData,
      errors: row.errors,
    })),
  });

  logger.info("Persisted order error records", {
    uploadId,
    count: created.count,
  });

  return created.count;
}

/**
 * Retrieves a single order by orderId, including partition routing metadata.
 */
export async function findOrderByOrderId(orderId: string) {
  const order = await prisma.order.findFirst({
    where: { orderId },
  });

  if (!order) return null;

  const shardInfo = await getShardInfo(order.customerId);

  return {
    ...order,
    shardInfo,
  };
}

/**
 * Retrieves paginated list of orders for a customer with optional status filtering.
 */
export async function findOrdersByCustomerId(params: QueryOrdersParams) {
  const { customerId, status, page, limit } = params;
  const skip = (page - 1) * limit;

  const whereCondition: { customerId?: string; status?: string } = {};
  if (customerId) {
    whereCondition.customerId = customerId;
  }
  if (status) {
    whereCondition.status = status.toLowerCase();
  }

  const [total, orders] = await Promise.all([
    prisma.order.count({ where: whereCondition }),
    prisma.order.findMany({
      where: whereCondition,
      orderBy: { orderDate: "desc" },
      skip,
      take: limit,
    }),
  ]);

  const shardInfo = customerId ? await getShardInfo(customerId) : null;
  const totalPages = Math.ceil(total / limit);

  return {
    orders,
    ...(shardInfo && { shardInfo }),
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

/**
 * Retrieves persisted error records for a given upload session ID.
 */
export async function findErrorsByUploadId(uploadId: string) {
  const errors = await (prisma as any).orderError.findMany({
    where: { uploadId },
    orderBy: { rowNumber: "asc" },
  });

  return errors;
}

/**
 * Computes which hash partition a given customerId routes to.
 */
export async function getShardInfo(customerId: string): Promise<ShardMetadata> {
  try {
    const result = await prisma.$queryRaw<
      { partition: string }[]
    >`SELECT tableoid::regclass::text AS partition
      FROM orders
      WHERE customer_id = ${customerId}
      LIMIT 1`;

    if (result.length > 0 && result[0].partition) {
      const partition = result[0].partition;
      const partitionIndex = parseInt(partition.replace("orders_p", ""), 10);
      return {
        partition,
        partitionIndex: isNaN(partitionIndex) ? 0 : partitionIndex,
      };
    }
  } catch {
    // If raw query fails or no data exists yet, compute expected hash partition
  }

  // Fallback / Pre-insert calculation using PostgreSQL hashtext algorithm simulation
  let hash = 0;
  for (let i = 0; i < customerId.length; i++) {
    hash = (hash * 31 + customerId.charCodeAt(i)) | 0;
  }
  const partitionIndex = Math.abs(hash) % NUM_PARTITIONS;

  return {
    partition: `orders_p${partitionIndex}`,
    partitionIndex,
  };
}

/**
 * Returns total counts and distribution of orders across PostgreSQL hash partitions.
 */
export async function getPartitionMetrics() {
  let partitions: { partition: string; count: number }[] = [];
  let totalOrders = 0;
  let totalErrors = 0;

  try {
    const [rawPartitions, orderCount, errorCount] = await Promise.all([
      prisma.$queryRaw<
        { partition: string; count: bigint }[]
      >`SELECT tableoid::regclass::text AS partition, COUNT(*)::bigint AS count
        FROM orders
        GROUP BY tableoid
        ORDER BY partition`,
      prisma.order.count(),
      (prisma as any).orderError.count(),
    ]);

    partitions = rawPartitions.map(
      (p: { partition: string; count: bigint }) => ({
        partition: p.partition,
        count: Number(p.count),
      }),
    );
    totalOrders = orderCount;
    totalErrors = errorCount;
  } catch (err) {
    logger.warn("Could not query partition distribution", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return {
    totalOrders,
    totalErrors,
    partitions,
  };
}
