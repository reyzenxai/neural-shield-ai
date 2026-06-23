import { Router } from "express";

import { submitReport } from "../controllers/report.controller";
import { authenticate } from "../middleware/auth.middleware";
import { scanLimiter } from "../middleware/rateLimit.middleware";

const router = Router();

router.post("/", authenticate, scanLimiter, submitReport);

export default router;
