# Backend Architecture

> Express 4.21 on TypeScript (compiled to CommonJS). Runs both as a long-running process
> (`src/server.ts`) and as a **Vercel serverless function** (`api/index.ts`, which exports the
> Express app; `vercel.json` rewrites all traffic to it).

## Request lifecycle

```
routes → middleware (auth / rate-limit / validate / upload) → controllers → services / threat-engine → Supabase (RLS or SECURITY DEFINER RPC)
```

Controllers are thin; the engine and services hold the logic. Every response uses a standard JSON
envelope from `utils/response.ts`:
`{ success, message, data, timestamp }` / `{ success, message, details, timestamp }`.

## App wiring (`src/app.ts`)

1. `trust proxy = 1` — correct client IP behind Vercel.
2. **Helmet** with a tight CSP (`default-src 'self'`, `connect-src 'self' https://openrouter.ai`,
   `img-src 'self' data:`).
3. **CORS** — allow-list from `APP_URL` + `FRONTEND_URL`; extensions always allowed; **fails closed
   in production** if the allow-list is empty (hardened on the security branch).
4. `express.json({ limit: '1mb' })` + urlencoded.
5. Global rate limiter on `/api`.
6. Route mounts, then `notFound` + `errorHandler`.

## Routes → controllers

| Router | Controller | Notes |
|---|---|---|
| `health.routes` | inline | Public health/status. |
| `scan.routes` | `scan.controller` | 5 text scanners (auth + rate limit + Zod); 2 image scanners (Pro-gated multipart). |
| `report.routes` | `report.controller` | Community report (JWT only, not API key). |
| `reputation.routes` | `reputation.controller` | Public reputation lookup (rate-limited). |
| `extension.routes` | `extension.controller` | Public `/config`; authed `/analyze` batch. |
| `admin.routes` | `admin.controller` | All routes `authenticate + requireAdmin()`. |

## Middleware

- **auth** — API key (SHA-256 → `app_verify_api_key` RPC, Pro-gated) or Supabase JWT
  (`verifyToken`). Dev bypass only when Supabase is unconfigured **and** not production.
- **rateLimit** — global 100/15 min per IP; scan 30/15 min per user-or-IP; extension 60/min;
  reputation 120/min.
- **validate** — `validateBody(schema)` runs Zod; 400 with flattened errors.
- **upload** — multer memory storage, field `file`, 10 MB, PNG/JPG/WebP only.
- **error** — `notFound` (404) + central `errorHandler` (clean messages, no stack leakage).

## Services

- **ai.service** — OpenRouter fallback chain with per-model timeout; `analyze()` (legacy full
  scorer), `explain()` (v2 narrative, never throws — falls back to `templatedExplanation`),
  `inferScamType()`.
- **scan.service** — `checkAndConsumeLimits` (now via the `app_consume_scan_quota` RPC with a
  legacy fallback), `saveScan` (scan + flags + signals under RLS), `audit`.
- **extract.service** — OCR (Tesseract.js) and QR decode (jimp + jsQR).
- **supabase.service** — anon client, `getUserClient(token)` (request-scoped RLS client),
  `verifyToken` (resolves effective plan + admin flag), `verifyApiKey`, `recordApiScan`.

## The engine

`threat-engine/` is the core (see [trust-score-engine.md](trust-score-engine.md)). Two modes gated
by `ENGINE_V2`: `true` (default) runs the deterministic engine + LLM explainer; `false` runs the
legacy LLM-as-scorer path unchanged.

## Logging & errors

Winston (`utils/logger.ts`); file transports skipped on Vercel. Sentry initialized in
`src/instrument.ts`, imported first in `server.ts`. Scan failures return a clean `502`; quota
breaches return `429` with a `DAILY_LIMIT_EXCEEDED` code.

## Why no service-role key

The backend runs under **each user's JWT**, so the database (RLS) enforces access. Privileged
operations use `SECURITY DEFINER` RPCs. A compromised backend process therefore cannot read or
write across users. See [security.md](security.md) and [authorization.md](authorization.md).

## Deploy note

The backend's Vercel **root directory must be `backend`** so the workspace dependency
`@neural-shield/types` resolves. OCR (Tesseract) is unreliable on serverless — a container host
(`backend/Dockerfile`) is recommended for reliable screenshot/QR scanning.
