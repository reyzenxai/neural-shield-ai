import rateLimit from "express-rate-limit";
import type { Request } from "express";

/** Resolve a rate-limit key: authenticated user id, else client IP. */
function userOrIp(req: Request): string {
  return req.user?.id ?? req.ip ?? "unknown";
}

/** Global limiter — 100 requests / 15 min per IP. */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests", details: { retryAfter: 900 } },
});

/** Scan limiter — caps free-tier abuse at 30 scan calls / 15 min per user. */
export const scanLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIp,
  message: {
    success: false,
    message: "Too many scans in a short period. Please slow down.",
    details: { retryAfter: 900 },
  },
});
