# Monitoring

> How you know the system is healthy — and how you'll know when it isn't. Today: Sentry + Winston
> logs + a health endpoint + audit tables. Alerting is the main gap to close.

## What exists now

- **Health endpoint:** `GET /api/health` returns service status + booleans for whether AI and
  Supabase are configured. Use it for uptime checks.
- **Sentry** (`@sentry/nextjs`, `@sentry/node`): captures frontend + backend errors and performance.
  Initialized in `backend/src/instrument.ts` (imported first). The Next app tunnels Sentry through
  `/monitoring` to dodge ad-blockers.
- **Winston logs** (`backend/src/utils/logger.ts`): structured logs; file transports are skipped on
  Vercel (use Vercel's log drains / dashboard there).
- **Audit tables:** `audit_logs` (user actions, written as the user under RLS) and `admin_logs`
  (admin actions) give a security/operational trail.
- **Supabase Advisors:** the dashboard's Security + Performance advisors flag missing indexes, RLS
  gaps, etc.

## Recommended setup (owner)

1. **Uptime monitor** — point an external monitor (UptimeRobot / BetterStack / Cloudflare Health
   Checks) at `GET /api/health` and the frontend root; alert on failure.
2. **Sentry alerts** — configure alert rules: new error types, error-rate spikes, and slow
   transactions → email/Slack.
3. **Vercel** — enable log drains or check the dashboard; watch function error rate + duration
   (the backend function has a 60s cap; OCR is the slow path).
4. **Supabase** — enable email alerts for high DB load / connection saturation; run the Advisors
   monthly.

## Signals worth alerting on (backlog)

- **Auth anomalies** — spikes in 401s / failed logins (credential stuffing).
- **Rate-limit spikes** — sustained 429s (abuse or a broken client).
- **Collector coverage drop** — key-gated collectors (GSB/VT/AbuseIPDB) silently skip when keys are
  unset, lowering detection confidence. Emit a metric when coverage is low so you notice.
- **AI fallback usage** — how often the primary model fails over (cost + quality signal).
- **502/scan failure rate** — the engine failing to complete scans.

## Where to look when things are slow/broken

| Symptom | First place to look |
|---|---|
| Site down | Vercel status + deployment logs; `/api/health` |
| Scans failing (502) | Backend Sentry + Vercel function logs (OpenRouter/collector errors) |
| Everyone CORS-blocked | Backend `FRONTEND_URL` env (prod fails closed) |
| DB errors | Supabase dashboard → Logs + Advisors |
| Slow image scans | OCR on serverless — consider the container host |

See [troubleshooting.md](troubleshooting.md) for specific fixes and [incident-response.md](incident-response.md)
for security incidents.
