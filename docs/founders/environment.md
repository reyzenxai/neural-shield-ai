# Environment Variables

> Purpose and required/optional only — **no secret values**. Set these in Vercel (per project),
> Supabase (edge-function secrets), and local `.env` files (which are gitignored).

## Backend (`backend/.env` / Vercel backend project)

| Var | Purpose | Required? |
|---|---|---|
| `NODE_ENV` | Environment; gates the dev auth bypass and CORS fail-closed. | **Set `production` in prod.** |
| `PORT` | Listen port (default 5000). | Optional. |
| `APP_URL` | App URL; part of CORS allow-list + OpenRouter referer. | Recommended. |
| `FRONTEND_URL` | Deployed frontend origin(s), comma-separated. **Required in prod** or CORS (fail-closed) blocks the browser. | **Prod-required.** |
| `OPENROUTER_API_KEY` | LLM explanations. Falls back to templated text if unset. | Required for AI. |
| `OPENROUTER_MODELS` | Override the fallback model chain. | Optional. |
| `OPENROUTER_TIMEOUT_MS` | Per-model timeout (default 25000). | Optional. |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Backend Supabase (RLS) client. | **Required in prod.** |
| `SUPABASE_SERVICE_ROLE_KEY` | Declared but **not read by the backend** (edge functions get it automatically). | Not used. |
| `LOG_LEVEL` | Winston level. | Optional. |
| `ENGINE_V2` | `true` = deterministic engine (default); `false` = legacy LLM scorer. | Optional. |
| `ENGINE_DISABLE_NETWORK` | Kill switch for all network collectors. | Optional. |
| `ENGINE_COLLECTION_BUDGET_MS` | Total network collection budget (default 4000). | Optional. |
| `RDAP_ENABLED` / `TLS_ENABLED` / `REDIRECT_ENABLED` | Toggle no-key collectors (default on). | Optional. |
| `URLHAUS_ENABLED` / `URLHAUS_AUTH_KEY` | URLHaus feed. | Optional. |
| `GSB_API_KEY` | Google Safe Browsing (non-commercial — move to Web Risk for commercial use). | Optional. |
| `PHISHTANK_ENABLED` / `PHISHTANK_APP_KEY` | PhishTank (off by default). | Optional. |
| `OPENPHISH_ENABLED` / `OPENPHISH_FEED_URL` | OpenPhish (off by default). | Optional. |
| `VIRUSTOTAL_API_KEY` / `ABUSEIPDB_API_KEY` | VT / AbuseIPDB collectors. | Optional (coverage drops if unset). |

## Frontend (`frontend/.env.local` / Vercel frontend project)

| Var | Purpose | Required? |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Backend base (includes `/api`). | **Required.** |
| `NEXT_PUBLIC_APP_URL` | App URL. | Recommended. |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase browser client. | **Required (auth).** |
| `NEXT_PUBLIC_UPI_VPA` / `NEXT_PUBLIC_UPI_PAYEE` | UPI payee for the upgrade flow. | Required to enable upgrades. |

> `NEXT_PUBLIC_*` is compiled into the browser bundle and is **public by design** (the Supabase anon
> key is safe because RLS protects the data). Never put a secret in a `NEXT_PUBLIC_*` var.

## Edge-function secrets (Supabase dashboard → Edge Functions → Secrets)

- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` — only if you reactivate the (currently dormant) Razorpay
  path. Prices are now catalog-correct.
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

## Mobile / extension / n8n

- Mobile: `EXPO_PUBLIC_SUPABASE_*` (anon key in `eas.json` — public, RLS-safe).
- Extension: Supabase URL + anon key hardcoded in `extension/src/config.ts`; `DEFAULT_API_URL`
  must be overridden for production.
- n8n: `N8N_HOST`, `WEBHOOK_URL`, `N8N_ENCRYPTION_KEY`, `GENERIC_TIMEZONE` (see
  [self-hosted-n8n.md](self-hosted-n8n.md)).

## Validation habit

There is no runtime env schema validation yet (a nice future addition — fail fast on a missing
`SUPABASE_URL` in prod). Until then, use the [deployment.md](deployment.md) checklist before every
production deploy.
