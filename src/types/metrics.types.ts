export interface PartitionMetric {
  partition: string;
  count: number;
}

export interface PartitionMetricsResult {
  totalOrders: number;
  totalErrors: number;
  partitions: PartitionMetric[];
}

export interface SystemMetricsResponse {
  success: boolean;
  timestamp: string;
  system: {
    uptimeSeconds: number;
    memoryUsage: {
      rssBytes: number;
      heapTotalBytes: number;
      heapUsedBytes: number;
    };
  };
  database: {
    status: string;
    pingLatencyMs: number;
    totalOrders: number;
    totalErrors: number;
    partitions: PartitionMetric[];
  };
}
