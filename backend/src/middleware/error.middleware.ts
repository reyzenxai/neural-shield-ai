import type { NextFunction, Request, Response } from "express";

import { failure } from "../utils/response";
import { logger } from "../utils/logger";

/** 404 handler for unmatched routes. */
export function notFound(req: Request, res: Response): void {
  failure(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
}

/** Central error handler — logs and returns the standard error envelope. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const message = err instanceof Error ? err.message : "Internal server error";
  logger.error(`Unhandled error: ${message}`, { stack: err instanceof Error ? err.stack : undefined });
  failure(res, "Something went wrong. Please try again.", 500);
}
