import type { Request, Response } from "express";
import { z } from "zod";

import { config } from "../config";
import { runEngine } from "../threat-engine";
import { BAND_THRESHOLDS, ENGINE_VERSION } from "../threat-engine/config/weights";
import { failure, success } from "../utils/response";
import { logger } from "../utils/logger";
import type { ScanType } from "../types";

const TYPE_TO_SCAN: Record<string, ScanType> = {
  url: "url",
  domain: "url",
  email: "email",
  phone: "phone",
  upi: "upi",
  text: "message",
};

const BatchSchema = z.object({
  entities: z
    .array(
      z.object({
        type: z.enum(["url", "domain", "email", "phone", "upi", "text"]),
        value: z.string().min(1).max(2048),
      }),
    )
    .min(1)
    .max(10),
});

export async function batchAnalyze(req: Request, res: Response): Promise<void> {
  const parsed = BatchSchema.safeParse(req.body);
  if (!parsed.success) {
    failure(res, "Invalid batch request.", 400, parsed.error.flatten());
    return;
  }

  const { entities } = parsed.data;

  const settled = await Promise.allSettled(
    entities.map(async ({ type, value }) => {
      if (!config.engineV2) {
        return { type, value, riskScore: null, riskLevel: "unknown", confidence: 0, signals: [], engineVersion: null };
      }
      const scanType = TYPE_TO_SCAN[type] ?? "message";
      const result = await runEngine(scanType, value, { skipExplain: true });
      return {
        type,
        value,
        riskScore: result.riskScore,
        riskLevel: result.riskLevel,
        confidence: result.confidence,
        verdictLabel: result.verdictLabel,
        signals: result.signals.map((s) => ({ id: s.id, label: s.label, weight: s.weight, category: s.category })),
        engineVersion: result.engineVersion,
      };
    }),
  );

  const results = settled.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    logger.warn(`batchAnalyze[${i}] ${entities[i].value}: ${r.reason}`);
    return {
      type: entities[i].type,
      value: entities[i].value,
      riskScore: null,
      riskLevel: "error" as const,
      confidence: 0,
      verdictLabel: "Error",
      signals: [],
      engineVersion: null,
      error: "Analysis failed for this entity.",
    };
  });

  success(res, { results });
}

export function getExtensionConfig(_req: Request, res: Response): void {
  success(res, {
    engineVersion: ENGINE_VERSION,
    engineV2: config.engineV2,
    thresholds: BAND_THRESHOLDS,
    maxBatchSize: 10,
    supportedTypes: ["url", "domain", "email", "phone", "upi", "text"],
  });
}
