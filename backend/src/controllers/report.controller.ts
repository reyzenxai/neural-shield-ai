import type { Request, Response } from "express";
import { z } from "zod";

import { getUserClient } from "../services/supabase.service";
import { failure, success } from "../utils/response";
import { logger } from "../utils/logger";

const ReportSchema = z.object({
  entityType: z.enum(["url", "domain", "email", "phone", "upi", "ip", "text"]),
  entityValue: z.string().min(1).max(2048),
  reportType: z.enum(["scam", "phishing", "spam", "fraud", "other"]),
  notes: z.string().max(1000).optional(),
});

export async function submitReport(req: Request, res: Response): Promise<void> {
  // API-key auth has no JWT — reports require a user session.
  if (req.apiKeyHash) {
    failure(res, "Report submission requires user authentication, not an API key.", 403);
    return;
  }

  const parsed = ReportSchema.safeParse(req.body);
  if (!parsed.success) {
    failure(res, "Invalid report body.", 400, parsed.error.flatten());
    return;
  }

  const { entityType, entityValue, reportType, notes } = parsed.data;
  const db = getUserClient(req.userToken);
  if (!db) {
    failure(res, "Authentication required.", 401);
    return;
  }

  try {
    const { data, error } = await db.rpc("app_submit_report", {
      p_entity_type:  entityType,
      p_entity_value: entityValue,
      p_report_type:  reportType,
      p_notes:        notes ?? null,
    });

    if (error) {
      if (error.message?.includes("unauthenticated")) {
        failure(res, "Authentication required.", 401);
        return;
      }
      logger.warn(`app_submit_report failed: ${error.message}`);
      failure(res, "Failed to submit report. Please try again.", 500);
      return;
    }

    success(res, { id: data }, "Report submitted. Thank you for helping keep the community safe.", 201);
  } catch (err) {
    logger.error(`submitReport: ${err instanceof Error ? err.message : String(err)}`);
    failure(res, "Failed to submit report. Please try again.", 500);
  }
}
