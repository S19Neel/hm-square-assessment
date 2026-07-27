import { RetryOptions } from "../types/index.js";
import { logger } from "./logger.js";

/**
 * Executes an async operation with automatic exponential backoff retries and jitter.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 200,
    maxDelayMs = 3000,
    operationName = "Operation",
  } = options;

  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      attempt++;
      if (attempt > maxRetries) {
        logger.error(`${operationName} failed after ${maxRetries} attempts`, {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }

      const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 100;
      const delay = Math.min(exponentialDelay + jitter, maxDelayMs);

      logger.warn(
        `${operationName} failed (attempt ${attempt}/${maxRetries}), retrying in ${Math.round(delay)}ms...`,
        { error: error instanceof Error ? error.message : String(error) },
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
