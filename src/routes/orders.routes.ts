import { Router } from "express";
import { upload } from "../middleware/upload.middleware.js";
import { uploadOrders } from "../controllers/orders.controller.js";

const router: Router = Router();

/**
 * POST /upload-orders
 *
 * Accepts a CSV file via multipart/form-data (field name: "file").
 * - Uploads the file to Google Cloud Storage
 * - Parses and validates CSV rows
 * - Batch inserts valid orders into PostgreSQL (hash-partitioned)
 * - Returns processing summary with error details
 */
router.post("/upload-orders", upload.single("file"), uploadOrders);

export default router;
