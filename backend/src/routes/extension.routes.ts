import { Router } from "express";
import rateLimit from "express-rate-limit";

import { batchAnalyze, getExtensionConfig } from "../controllers/extension.controller";
import { authenticate } from "../middleware/auth.middleware";

const extLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many extension requests. Try again in a minute." },
});

const router = Router();

// Config is public (no auth) — extension uses it to self-configure.
router.get("/config", getExtensionConfig);

// Batch analyze requires auth (JWT any plan, or API key).
router.post("/analyze", authenticate, extLimiter, batchAnalyze);

export default router;
