import cors from "cors";
import express from "express";
import helmet from "helmet";

import { config } from "./config";
import { globalLimiter } from "./middleware/rateLimit.middleware";
import { errorHandler, notFound } from "./middleware/error.middleware";
import healthRoutes from "./routes/health.routes";
import scanRoutes from "./routes/scan.routes";

export function createApp() {
  const app = express();

  // Behind a proxy (Vercel/Render/etc.) so rate-limit sees the real client IP.
  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          connectSrc: ["'self'", "https://openrouter.ai"],
          imgSrc: ["'self'", "data:"],
        },
      },
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  app.use(
    cors({
      origin: config.corsOrigins.length ? config.corsOrigins : true,
      credentials: true,
    }),
  );

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Global rate limit on the API surface.
  app.use("/api", globalLimiter);

  app.use("/api/health", healthRoutes);
  app.use("/api/scan", scanRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
