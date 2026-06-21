import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodSchema } from "zod";

import { failure } from "../utils/response";

/**
 * Validate (and trim/transform) `req.body` against a Zod schema. On success the
 * parsed value replaces `req.body`; on failure responds 400 with field details.
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        failure(
          res,
          "Invalid input",
          400,
          err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        );
        return;
      }
      next(err);
    }
  };
}
