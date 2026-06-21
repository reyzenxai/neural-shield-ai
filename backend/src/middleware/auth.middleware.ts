import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

import { config, isSupabaseConfigured } from "../config";
import { verifyApiKey, verifyToken } from "../services/supabase.service";
import { failure } from "../utils/response";
import { logger } from "../utils/logger";
import type { AuthUser } from "../types";

const API_KEY_PREFIX = "nsk_";

/** Resolve an API key from the X-API-Key header or an `nsk_`-prefixed Bearer token. */
function extractApiKey(req: Request): string | null {
  const header = req.header("x-api-key");
  if (header) return header.trim();
  const bearer = req.headers.authorization?.split(" ")[1];
  if (bearer && bearer.startsWith(API_KEY_PREFIX)) return bearer.trim();
  return null;
}

/** Dev-only fallback user used when Supabase is not configured (never in prod). */
const DEV_USER: AuthUser = {
  id: "00000000-0000-0000-0000-000000000000",
  email: "dev@local",
  plan: "free",
};

let warnedDevMode = false;

/**
 * Authenticate the request using the Supabase access token in the Authorization
 * header. In non-production environments without Supabase configured, requests
 * are allowed through as a fixed dev user so the scanner can be exercised
 * locally. This bypass is hard-disabled in production.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  // 1) API key auth (Business tier) — for programmatic access.
  const apiKey = extractApiKey(req);
  if (apiKey) {
    if (!isSupabaseConfigured) {
      failure(res, "Server auth is not configured.", 503);
      return;
    }
    const hash = createHash("sha256").update(apiKey).digest("hex");
    const user = await verifyApiKey(hash);
    if (!user) {
      failure(res, "Invalid or revoked API key", 401);
      return;
    }
    if (user.plan !== "business") {
      failure(res, "API access requires the Business plan.", 403);
      return;
    }
    req.user = user;
    req.apiKeyHash = hash;
    next();
    return;
  }

  // 2) Supabase JWT auth (web app).
  if (!isSupabaseConfigured) {
    if (config.isProd) {
      failure(res, "Server auth is not configured.", 503);
      return;
    }
    if (!warnedDevMode) {
      logger.warn("Supabase not configured — using DEV auth bypass (development only).");
      warnedDevMode = true;
    }
    req.user = DEV_USER;
    next();
    return;
  }

  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    failure(res, "Authentication required", 401);
    return;
  }

  const user = await verifyToken(token);
  if (!user) {
    failure(res, "Invalid or expired token", 401);
    return;
  }

  req.user = user;
  req.userToken = token;
  next();
}

/** Restrict a route to specific plans. */
export function requirePlan(plans: AuthUser["plan"][]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !plans.includes(req.user.plan)) {
      failure(res, `This feature requires the ${plans.join(" or ")} plan.`, 403);
      return;
    }
    next();
  };
}
