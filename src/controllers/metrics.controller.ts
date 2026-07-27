import type { Request, Response } from "express";
import { pingDatabase } from "../config/database.js";
import { getPartitionMetrics } from "../services/orders.service.js";

/**
 * GET /metrics
 *
 * System & Database partition metrics endpoint.
 * Reports database status, total records, order distribution per hash partition,
 * memory usage, and uptime.
 */
export async function getSystemMetrics(
  _req: Request,
  res: Response,
): Promise<void> {
  const startTime = Date.now();
  const dbConnected = await pingDatabase();
  const pingLatencyMs = Date.now() - startTime;

  const partitionMetrics = await getPartitionMetrics();

  res.status(200).json({
    success: true,
    timestamp: new Date().toISOString(),
    system: {
      uptimeSeconds: Math.floor(process.uptime()),
      memoryUsage: {
        rssBytes: process.memoryUsage().rss,
        heapTotalBytes: process.memoryUsage().heapTotal,
        heapUsedBytes: process.memoryUsage().heapUsed,
      },
    },
    database: {
      status: dbConnected ? "CONNECTED" : "DISCONNECTED",
      pingLatencyMs,
      totalOrders: partitionMetrics.totalOrders,
      totalErrors: partitionMetrics.totalErrors,
      partitions: partitionMetrics.partitions,
    },
  });
}
