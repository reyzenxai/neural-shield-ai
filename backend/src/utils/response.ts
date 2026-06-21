import type { Response } from "express";

/** Standard success envelope. */
export function success<T>(
  res: Response,
  data: T,
  message = "Success",
  code = 200,
): Response {
  return res.status(code).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
}

/** Standard error envelope. */
export function failure(
  res: Response,
  message: string,
  code = 400,
  details: unknown = null,
): Response {
  return res.status(code).json({
    success: false,
    message,
    details,
    timestamp: new Date().toISOString(),
  });
}
