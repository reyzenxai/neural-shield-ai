import { Router } from "express";

import { isAiConfigured, isSupabaseConfigured } from "../config";
import { success } from "../utils/response";

const router = Router();

router.get("/", (_req, res) => {
  success(res, {
    status: "ok",
    service: "neural-shield-backend",
    version: "1.0.0",
    ai: isAiConfigured ? "configured" : "not_configured",
    supabase: isSupabaseConfigured ? "configured" : "not_configured",
  });
});

export default router;
