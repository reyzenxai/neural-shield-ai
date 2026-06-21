import multer from "multer";
import type { NextFunction, Request, Response } from "express";

import { failure } from "../utils/response";

const single = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpe?g|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error("Only PNG, JPG, or WebP images are allowed."));
  },
}).single("file");

/** Accept a single `file` image upload (<=10MB), returning clean 400s on error. */
export function uploadImage(req: Request, res: Response, next: NextFunction): void {
  single(req, res, (err: unknown) => {
    if (err) {
      const message =
        err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
          ? "Image is too large (max 10 MB)."
          : err instanceof Error
            ? err.message
            : "Upload failed.";
      failure(res, message, 400);
      return;
    }
    next();
  });
}
