import { Router } from "express";

import {
  scanEmail,
  scanMessage,
  scanPhone,
  scanQr,
  scanScreenshot,
  scanUpi,
  scanUrl,
} from "../controllers/scan.controller";
import { authenticate, requirePlan } from "../middleware/auth.middleware";
import { scanLimiter } from "../middleware/rateLimit.middleware";
import { uploadImage } from "../middleware/upload.middleware";
import { validateBody } from "../middleware/validate.middleware";
import {
  EmailScanSchema,
  MessageScanSchema,
  PhoneScanSchema,
  UpiScanSchema,
  UrlScanSchema,
} from "../schemas/scan.schemas";

const router = Router();

// All scan routes require auth + the scan rate limiter.
router.use(authenticate, scanLimiter);

router.post("/message", validateBody(MessageScanSchema), scanMessage);
router.post("/url", validateBody(UrlScanSchema), scanUrl);
router.post("/email", validateBody(EmailScanSchema), scanEmail);
router.post("/phone", validateBody(PhoneScanSchema), scanPhone);
router.post("/upi", validateBody(UpiScanSchema), scanUpi);

// Image scanners are Pro-tier: OCR a screenshot / decode a QR, then analyze.
router.post("/screenshot", requirePlan(["pro", "business"]), uploadImage, scanScreenshot);
router.post("/qr", requirePlan(["pro", "business"]), uploadImage, scanQr);

export default router;
