import express, { Express, Request, Response } from "express";
import { env } from "./config/env.js";
import {
  connectDatabase,
  disconnectDatabase,
  pingDatabase,
} from "./config/database.js";
import { logger } from "./utils/logger.js";
import { errorHandler } from "./middleware/error.middleware.js";
import ordersRoutes from "./routes/orders.routes.js";

const app: Express = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use(ordersRoutes);

// Root Route
app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    message: "Server is running",
    healthCheck: "/health",
  });
});

// Health Checkup Route
app.get("/health", async (_req: Request, res: Response) => {
  const dbHealthy = await pingDatabase();
  const status = dbHealthy ? "UP" : "DEGRADED";
  const statusCode = dbHealthy ? 200 : 503;

  res.status(statusCode).json({
    status,
    message: dbHealthy
      ? "Server and database are healthy"
      : "Database connection issues",
    database: dbHealthy ? "CONNECTED" : "DISCONNECTED",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Global Error Handler Middleware
app.use(errorHandler);

// Start server
async function start(): Promise<void> {
  await connectDatabase();

  app.listen(env.PORT, () => {
    logger.info(`🚀 Server running on http://localhost:${env.PORT}`);
  });
}

// Graceful shutdown
function setupGracefulShutdown(): void {
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];

  for (const signal of signals) {
    process.on(signal, async () => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      await disconnectDatabase();
      process.exit(0);
    });
  }
}

setupGracefulShutdown();
start().catch((error) => {
  logger.error("Failed to start server", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});

export default app;
