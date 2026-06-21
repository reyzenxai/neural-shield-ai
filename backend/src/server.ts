import { createApp } from "./app";
import { config, isAiConfigured, isSupabaseConfigured } from "./config";
import { logger } from "./utils/logger";

const app = createApp();

app.listen(config.port, () => {
  logger.info(`🚀 Neural Shield API on port ${config.port} [${config.env}]`);
  logger.info(`   AI: ${isAiConfigured ? "configured" : "NOT configured"}`);
  logger.info(`   Supabase: ${isSupabaseConfigured ? "configured" : "NOT configured (dev auth bypass)"}`);
});

process.on("unhandledRejection", (reason) => {
  logger.error(`Unhandled rejection: ${reason instanceof Error ? reason.message : String(reason)}`);
});
