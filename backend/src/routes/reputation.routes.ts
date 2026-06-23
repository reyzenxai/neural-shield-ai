import { Router } from "express";
import rateLimit from "express-rate-limit";

import { getReputation } from "../controllers/reputation.controller";

const repLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many reputation lookups. Try again in a minute." },
});

const router = Router();

// Public endpoint — no auth required, rate-limited.
router.get("/:type/:value", repLimiter, getReputation);

export default router;
