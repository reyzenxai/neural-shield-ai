# Pull Request — Production Security Hardening & Founder Documentation

**Branch:** `security/production-hardening` → `main`
**Type:** Security hardening + documentation (no feature changes, no business-logic changes)
**Date:** 2026-07-04

---

## Overview

A production-readiness pass focused on the **website launch path** (web + backend + database +
auth). It closes the concrete security/correctness gaps flagged in `context.md`, applies the
requested "Upgrade Plan" wording change across the app, and adds a complete security-report set plus
a founder documentation library. No existing feature was removed or redesigned; business logic is
unchanged except where it directly improves security.

## Summary of changes

**Code / security (launch-critical, low-risk):**
1. **Scan-quota consumption → `SECURITY DEFINER` RPC.** New migration
   `0013_scan_quota_consume_function.sql` adds `app_consume_scan_quota(daily, monthly)` (atomic,
   row-locked, `auth.uid()`-scoped) and **revokes the counter columns** from client UPDATE.
   `scan.service.checkAndConsumeLimits` now calls the RPC with a safe legacy fallback for the
   migration window. Closes self-service quota reset + a concurrency race.
2. **CORS fails closed in production.** `app.ts` no longer reflects an arbitrary origin when the
   allow-list is empty in prod (dev behavior unchanged).
3. **Dormant Razorpay mispricing fixed.** `razorpay-checkout` `PRICES` now mirrors the current plan
   catalog and drops the removed `business` plan; the path stays dormant (503 until secrets set).

**UI:**
4. **"Upgrade to Pro" → "Upgrade Plan"** across the app (DashboardShell sidebar CTA + button,
   ProScannerNotice, Profile API-keys copy). Styling unchanged.

**Documentation:**
5. Security reports: `docs/security-audit.md`, `owasp-report.md`, `api-security.md`,
   `ai-security.md`, `infrastructure-security.md`, `security-roadmap.md`, `final-security-score.md`.
6. Founder runbooks: `docs/founders/*` (25 docs + index).
7. `context.md` updated to reflect every change above.

## Files changed

**Modified**
- `backend/src/app.ts` — CORS fail-closed in production.
- `backend/src/services/scan.service.ts` — RPC-based quota consume + legacy fallback.
- `supabase/functions/razorpay-checkout/index.ts` — corrected `PRICES`.
- `frontend/src/components/layout/DashboardShell.tsx` — "Upgrade Plan" / "Upgrade".
- `frontend/src/components/scanner/ProScannerNotice.tsx` — "Upgrade Plan".
- `frontend/src/components/profile/ApiKeys.tsx` — upgrade copy.
- `context.md` — synced.

**Added**
- `supabase/migrations/0013_scan_quota_consume_function.sql`
- `docs/security-audit.md`, `docs/owasp-report.md`, `docs/api-security.md`, `docs/ai-security.md`,
  `docs/infrastructure-security.md`, `docs/security-roadmap.md`, `docs/final-security-score.md`
- `docs/founders/*` (26 files incl. README)
- `docs/pull-request.md`, `docs/implementation-summary.md`

**Removed:** none.

## Architecture changes
- One new database function + a column-grant tightening (migration 0013). No table drops, no schema
  breaks. Additive and backward-compatible (backend falls back if the RPC is absent).

## Security improvements
- Self-service scan-quota reset **eliminated** (broken-access-control / cost abuse).
- CORS arbitrary-origin reflection in prod **eliminated**.
- Dormant payment mispricing hazard **eliminated**.
- Full threat model, OWASP Top 10 mapping, per-endpoint API review, and incident runbook delivered.

## OWASP fixes (mapping)
- **A01 Broken Access Control** — quota reset closed; counters RPC-only.
- **A05 Security Misconfiguration** — CORS fail-closed.
- **A08 Integrity** — Razorpay pricing correctness.
See `docs/owasp-report.md` for the full matrix.

## Authentication / Authorization improvements
- No auth flow changed. Authorization strengthened: counter columns revoked; consumption gated by a
  `SECURITY DEFINER` function with an internal `auth.uid()` check.

## Dependency updates
- None in this PR (read-heavy, low-risk pass). `npm audit`/`depcheck` in CI and `multer`/`jimp`
  upgrades are tracked in `docs/security-roadmap.md`.

## Risk assessment
- **Low.** Changes are additive and covered by the existing test suite (195/195 pass). The one
  behavioral change users could notice is intended: CORS now requires `FRONTEND_URL` in prod
  (documented). The quota RPC has a fallback so deploy ordering can't break metering.

## Testing performed
- Backend: `type-check` ✅, `lint` ✅, **195/195 tests** ✅.
- Frontend: `type-check` ✅, `lint` ✅ (0 errors; 6 pre-existing warnings unrelated to this PR).

## Manual testing checklist (for reviewers before/after merge)
- [ ] Apply migration 0013 to a staging DB; run scans until the daily cap → expect `429`.
- [ ] Attempt a direct `UPDATE profiles SET daily_scan_count = 0` as a normal user → expect denial.
- [ ] With `FRONTEND_URL` set, the web app calls the API without CORS errors.
- [ ] Unset `FRONTEND_URL` in a prod-like env → browser is blocked (fail-closed confirmed).
- [ ] Profile, sidebar, and Pro-notice show "Upgrade Plan" / "Upgrade".
- [ ] Full scan happy-path for each type still returns a verdict.

## Deployment notes
1. `supabase db push` (applies 0013).
2. Set/confirm Vercel backend env: `NODE_ENV=production`, `FRONTEND_URL`, Supabase keys, rotated
   `OPENROUTER_API_KEY`.
3. Merge → Vercel auto-deploys. See `docs/founders/deployment.md`.

## Rollback strategy
- **Code:** Vercel Instant Rollback to the previous deployment (frontend/backend independently).
- **DB:** re-grant the counter columns to `authenticated` and `drop function app_consume_scan_quota`
  (the backend then meters via the legacy path). Prefer fixing forward.

## Breaking changes
- None for end users. **Operational:** production now requires `FRONTEND_URL` (CORS fail-closed).

## Future recommendations
See `docs/security-roadmap.md`: rotate the leaked OpenRouter key (critical, owner), Google Web Risk
for commercial use, Cloudflare WAF/DDoS, SSRF denylist, dependency audit in CI, auth anti-automation,
and monitoring/alerting.

> **Do not merge automatically.** Intended for founder review + manual testing, then merge by the
> team. Branch left intact.
