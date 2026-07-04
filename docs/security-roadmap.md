# Neural Shield AI — Security Roadmap

> Prioritized, sequenced security work. Date: 2026-07-04. Items marked **[DONE — this branch]**
> shipped in `security/production-hardening`. Everything else is owner action or backlog.

---

## Now (pre-launch, this branch)

- **[DONE]** Move scan-quota consumption to `app_consume_scan_quota` `SECURITY DEFINER` RPC;
  revoke counter columns from clients (migration 0013). Closes self-service quota reset + race.
- **[DONE]** CORS fails closed in production (no arbitrary-origin reflection).
- **[DONE]** Fix dormant Razorpay `PRICES` (remove `business`, correct `pro`) so it cannot
  mis-price if reactivated.
- **[DONE]** Full documentation + threat model + OWASP mapping (this doc set).

## Critical — owner action before external launch/sharing

1. **Rotate the leaked OpenRouter key** (OpenRouter dashboard → revoke old, issue new → set in
   Vercel backend env). Confirm git history is scrubbed of any `.env`.
2. **Set production env** in Vercel backend: `NODE_ENV=production`, `FRONTEND_URL` (required for
   CORS), `SUPABASE_URL`, `SUPABASE_ANON_KEY`, rotated `OPENROUTER_API_KEY`.
3. **Apply migration 0013** (`supabase db push`) and deploy the backend so the RPC path is live.
   Order is safe either way (the backend falls back if the RPC is missing), but apply the
   migration promptly so the counter revoke takes effect.

## High — first weeks after launch

4. **Google Web Risk migration** — replace the non-commercial GSB collector for commercial use.
5. **Cloudflare in front** — WAF (OWASP ruleset), DDoS, DNSSEC, rate-limit rules on `/api/*`,
   Turnstile on auth (see `infrastructure-security.md`).
6. **SSRF denylist** — before any collector fetches a user URL directly, block RFC-1918 /
   loopback / link-local / `169.254.169.254` and non-HTTP schemes.
7. **Dependency audit in CI** — add `npm audit --audit-level=high` + `depcheck`; upgrade
   `multer` and `jimp`.

## Medium

8. **Auth anti-automation** — CAPTCHA/Turnstile + lockout policy on login/signup.
9. **Frontend CSP** — add a `Content-Security-Policy` to the Next app (report-only → enforce),
   accounting for Next/Sentry inline needs.
10. **Monitoring/alerting** — alerts on auth anomalies, rate-limit spikes, collector-coverage
    drops, and error-rate (Sentry). See `monitoring.md`.
11. **Container host for OCR** — run the backend on Railway/Render/Fly (`backend/Dockerfile`) for
    reliable Tesseract; keeps screenshot/QR Pro features dependable.
12. **AI-narration opt-out + secret redaction** before sending input to OpenRouter (privacy).

## Low / hygiene

13. Unify plan limits to one source of truth (generate `backend/src/config/plans.ts` from
    `packages/config`).
14. Generate the UPI QR locally to drop the `api.qrserver.com` dependency.
15. Consolidate/renumber migrations at the next safe reset; delete the unused `subscriptions`
    table if Razorpay stays dormant.
16. Fix mobile ↔ backend contract drift (field names, feedback payload, plan limit, schema
    columns) — Priority 3, not a website blocker.

---

## Sequencing rationale

The **this-branch** items remove the concrete exploitable/correctness issues in the launch path.
The **critical owner** items are operational (secrets + env + migration apply) and must precede any
external exposure. The **high** items (Web Risk, Cloudflare, SSRF denylist, dep audit) harden the
public surface and unblock a commercial launch. Everything below is defense-in-depth and
maintainability that can land iteratively without blocking users.
