import cors from "cors";
import express from "express";
import helmet from "helmet";

import { config } from "./config";
import { globalLimiter } from "./middleware/rateLimit.middleware";
import { errorHandler, notFound } from "./middleware/error.middleware";
import adminRoutes from "./routes/admin.routes";
import extensionRoutes from "./routes/extension.routes";
import healthRoutes from "./routes/health.routes";
import reportRoutes from "./routes/report.routes";
import reputationRoutes from "./routes/reputation.routes";
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
      origin(origin, callback) {
        // Non-browser clients (curl, health checks) send no Origin — allow them.
        if (!origin) return callback(null, true);
        // Browser extensions always allowed (they authenticate via JWT/key anyway).
        if (origin.startsWith("chrome-extension://") || origin.startsWith("moz-extension://")) {
          return callback(null, true);
        }
        // No allow-list configured:
        //  - production → fail closed (deny) so a missing FRONTEND_URL/APP_URL can
        //    never silently reflect an arbitrary origin;
        //  - non-production → reflect any origin (local dev convenience).
        if (!config.corsOrigins.length) return callback(null, !config.isProd);
        // Compare normalized (trailing slash stripped) so config typos don't 403.
        const normalized = origin.replace(/\/+$/, "");
        callback(null, config.corsOrigins.includes(normalized));
      },
      credentials: true,
    }),
  );

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Global rate limit on the API surface.
  app.use("/api", globalLimiter);

  app.use("/api/health", healthRoutes);
  app.use("/api/scan", scanRoutes);
  app.use("/api/report", reportRoutes);
  app.use("/api/reputation", reputationRoutes);
  app.use("/api/extension", extensionRoutes);
  app.use("/api/admin", adminRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
