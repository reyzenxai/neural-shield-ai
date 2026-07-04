# Analytics

> What we measure about product usage, where it comes from, and what's intentionally not tracked.

## Sources of truth

Most "analytics" are just **queries over the operational database** — there's no separate analytics
warehouse. The admin console reads aggregates via `SECURITY DEFINER` RPCs.

- **`admin_get_stats`** — aggregate counts powering the admin dashboard (users, scans, risk
  breakdown, etc.).
- **`scans`** table — every scan with its verdict, scam type, risk level, engine version, and
  timestamp. This is the richest usage signal (what people scan, what's risky).
- **`scan_signals`** — the evidence trail; useful for understanding *why* verdicts land where they
  do and for future model training.
- **`feedback`** — user agreement/disagreement on verdicts (accuracy signal).
- **`subscribers`** — newsletter sign-ups from the landing page.
- **`audit_logs` / `admin_logs`** — action trails (security + operational).

## Admin dashboard

`/admin/dashboard` shows the aggregates; `/admin/scans`, `/admin/users`, `/admin/feedback`,
`/admin/logs`, `/admin/payments` give drill-downs. All are admin-gated (RLS + `requireAdmin()` +
RPC re-check). Raw scan input is truncated to 120 chars in the admin scan list to limit sensitive
data exposure.

## Error/performance analytics

**Sentry** (frontend + backend) captures errors and performance traces (see
[monitoring.md](monitoring.md)). This is the closest thing to real-time product analytics today.

## What we deliberately don't do

- No third-party behavioral tracker / ad pixel is wired in by default (privacy-first posture for a
  security product). The landing page has a cookie banner (`CookieBanner`).
- No selling or sharing of scan content. Scanned inputs are the user's data (RLS-scoped); the only
  outbound flow is to OpenRouter for the explanation (disclosed in the privacy policy).

## Useful questions you can answer from the DB
- Daily/weekly active scanners; scans per plan.
- Most common scam types and risk-level distribution (fraud trends in India).
- Conversion: free → paid (via `payment_requests` approvals).
- Detection coverage: how often collectors are configured vs. skipped (add to monitoring).

## Future
- A privacy-respecting product-analytics layer (self-hosted, e.g., Plausible/PostHog) if you need
  funnels beyond DB queries.
- Aggregate, anonymized "scam trends" reporting as a public trust-building feature.
