import express, { Express, Request, Response } from "express";
import { env } from "./config/env.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { logger } from "./utils/logger.js";
import ordersRoutes from "./routes/orders.routes.js";

const app: Express = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use(ordersRoutes);

// Root Route
app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    message: "Server is running",
    healthCheck: "/health",
  });
});

// Health Checkup Route
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "UP",
    message: "Server is healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

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
