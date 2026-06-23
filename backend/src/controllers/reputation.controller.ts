import type { Request, Response } from "express";

import { getPublicClient } from "../services/supabase.service";
import { failure, success } from "../utils/response";
import { logger } from "../utils/logger";

const VALID_TYPES = new Set(["url", "domain", "email", "phone", "upi", "ip", "text"]);

export async function getReputation(req: Request, res: Response): Promise<void> {
  const { type, value } = req.params as { type: string; value: string };

  if (!VALID_TYPES.has(type)) {
    failure(res, `Invalid entity type. Must be one of: ${[...VALID_TYPES].join(", ")}.`, 400);
    return;
  }
  if (!value || value.length > 2048) {
    failure(res, "Entity value must be 1–2048 characters.", 400);
    return;
  }

  const client = getPublicClient();
  if (!client) {
    failure(res, "Reputation service unavailable.", 503);
    return;
  }

  try {
    const { data, error } = await client.rpc("app_get_reputation", {
      p_entity_type:  type,
      p_entity_value: decodeURIComponent(value),
    });

    if (error) {
      logger.warn(`app_get_reputation failed: ${error.message}`);
      failure(res, "Failed to fetch reputation data.", 500);
      return;
    }

    success(res, data);
  } catch (err) {
    logger.error(`getReputation: ${err instanceof Error ? err.message : String(err)}`);
    failure(res, "Failed to fetch reputation data.", 500);
  }
}
