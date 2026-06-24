import dotenv from "dotenv";

dotenv.config();

const {
  NODE_ENV = "development",
  PORT = "5000",
  APP_URL = "http://localhost:3000",
  FRONTEND_URL,
  OPENROUTER_API_KEY = "",
  OPENROUTER_MODELS,
  OPENROUTER_TIMEOUT_MS = "25000",
  SUPABASE_URL = "",
  SUPABASE_SERVICE_ROLE_KEY = "",
  SUPABASE_ANON_KEY = "",
  LOG_LEVEL = "info",
  ENGINE_V2 = "true",
  // Trust Engine v2 — evidence collection (Week 2)
  ENGINE_DISABLE_NETWORK = "false",
  ENGINE_COLLECTION_BUDGET_MS = "4000",
  RDAP_ENABLED = "true",
  TLS_ENABLED = "true",
  REDIRECT_ENABLED = "true",
  URLHAUS_ENABLED = "true",
  URLHAUS_AUTH_KEY = "",
  GSB_API_KEY = "",
  PHISHTANK_ENABLED = "false",
  PHISHTANK_APP_KEY = "",
  OPENPHISH_ENABLED = "false",
  OPENPHISH_FEED_URL = "https://openphish.com/feed.txt",
  VIRUSTOTAL_API_KEY = "",
  ABUSEIPDB_API_KEY = "",
} = process.env;

/** Ordered model fallback chain for OpenRouter (first that succeeds wins). */
const DEFAULT_MODELS = [
  "anthropic/claude-3.5-haiku",
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
];

export const config = {
  env: NODE_ENV,
  isProd: NODE_ENV === "production",
  port: Number(PORT),
  appUrl: APP_URL,
  // CORS allow-list: the app URL plus FRONTEND_URL (which may be a comma-separated
  // list of origins). Normalized — trailing slashes stripped — so a pasted
  // "https://app.vercel.app/" still matches the browser Origin "https://app.vercel.app".
  corsOrigins: [APP_URL, ...(FRONTEND_URL ? FRONTEND_URL.split(",") : [])]
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean),
  logLevel: LOG_LEVEL,

  openRouter: {
    apiKey: OPENROUTER_API_KEY,
    models: OPENROUTER_MODELS ? OPENROUTER_MODELS.split(",").map((m) => m.trim()) : DEFAULT_MODELS,
    // Per-model request timeout. Kept under Vercel's 60s function ceiling so a
    // hung upstream call fails over to the next model instead of timing out cold.
    timeoutMs: Number(OPENROUTER_TIMEOUT_MS) || 25000,
  },

  supabase: {
    url: SUPABASE_URL,
    serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
    anonKey: SUPABASE_ANON_KEY,
  },

  // Trust Engine v2: when false, scans use the legacy LLM-as-scorer path unchanged.
  // When true, the deterministic engine decides the score and the AI only explains.
  engineV2: ENGINE_V2 === "true",

  // Evidence collection (Week 2). `disableNetwork` is a master kill switch that skips
  // every network collector (rules + structural still run) — used in tests/air-gapped
  // envs. No-key sources default on; key/feed sources are off until configured.
  intel: {
    disableNetwork: ENGINE_DISABLE_NETWORK === "true",
    budgetMs: Number(ENGINE_COLLECTION_BUDGET_MS) || 4000,
    rdapEnabled: RDAP_ENABLED !== "false",
    tlsEnabled: TLS_ENABLED !== "false",
    redirectEnabled: REDIRECT_ENABLED !== "false",
    urlhaus: { enabled: URLHAUS_ENABLED !== "false", authKey: URLHAUS_AUTH_KEY },
    gsb: { apiKey: GSB_API_KEY },
    phishtank: { enabled: PHISHTANK_ENABLED === "true", appKey: PHISHTANK_APP_KEY },
    openphish: { enabled: OPENPHISH_ENABLED === "true", feedUrl: OPENPHISH_FEED_URL },
    virustotal: { apiKey: VIRUSTOTAL_API_KEY },
    abuseipdb: { apiKey: ABUSEIPDB_API_KEY },
  },
} as const;

export const isAiConfigured = Boolean(config.openRouter.apiKey);
// The backend operates under each user's JWT (RLS-enforced), so it only needs the
// project URL + anon key — no service-role secret.
export const isSupabaseConfigured = Boolean(config.supabase.url && config.supabase.anonKey);
