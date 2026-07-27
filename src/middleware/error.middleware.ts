import type { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";
import { env } from "../config/env.js";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const isOperational = err instanceof AppError ? err.isOperational : false;

  logger.error(err.message, {
    statusCode,
    isOperational,
    stack: err.stack,
  });

  res.status(statusCode).json({
    success: false,
    error: err.message || "Internal server error",
    ...(env.NODE_ENV === "development" && { stack: err.stack }),
  });
}
