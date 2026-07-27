import { Router } from "express";
import { upload } from "../middleware/upload.middleware.js";
import {
  uploadOrders,
  getOrderById,
  getOrdersByCustomer,
  getUploadErrors,
} from "../controllers/orders.controller.js";
import { getSystemMetrics } from "../controllers/metrics.controller.js";

const router: Router = Router();

/**
 * POST /upload-orders
 *
 * Accepts a CSV file via multipart/form-data (field name: "file").
 * - Uploads the file to Google Cloud Storage (with retries)
 * - Stream-parses CSV and batch inserts valid orders into PostgreSQL (hash-partitioned)
 * - Persists invalid rows into OrderError table
 * - Returns processing summary with uploadId and errors sample
 */
router.post("/upload-orders", upload.single("file"), uploadOrders);

/**
 * GET /orders/errors/:uploadId
 *
 * Fetches all persisted error records for a specific upload attempt.
 */
router.get("/orders/errors/:uploadId", getUploadErrors);

/**
 * GET /orders/:orderId
 *
 * Fetches a single order by orderId, including partition metadata.
 */
router.get("/orders/:orderId", getOrderById);

/**
 * GET /orders?customerId=...&status=...&page=...&limit=...
 *
 * Fetches paginated orders for a customer with optional status filtering.
 */
router.get("/orders", getOrdersByCustomer);

/**
 * GET /metrics
 *
 * Health & partition statistics metrics endpoint.
 */
router.get("/metrics", getSystemMetrics);

export default router;
