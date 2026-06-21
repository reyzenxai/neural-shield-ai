# Final Audit Report — Neural Shield AI

**Date:** 2026-06-21 · **Scope:** full repository, live Supabase project
(`jdcilinhabwilvbrjwjp`), deployed Vercel functions, and the AI surface.
**Method:** full source read + live schema/advisor inspection + real type-check / lint /
build / test runs on both apps.

---

## Headline

The application is **well-architected and largely production-grade already**: strict
TypeScript, RLS on every table, defence-in-depth auth, hardened headers, validated inputs,
and a clean serverless + container deployment story. The dominant risks were **not** in the
running code — they were in **project hygiene**: the production code is uncommitted, the
database/edge artifacts weren't versioned, a secret is in git history, and there were no
automated tests. This audit fixed what it safely could in-tree and flagged the rest.

## Verification (all green, run via PowerShell on Windows)

| Check | Frontend | Backend |
| --- | --- | --- |
| `type-check` (`tsc --noEmit`) | ✅ pass | ✅ pass |
| `lint` (ESLint) | ✅ pass | ✅ pass |
| `build` | ✅ pass (19 routes) | ✅ pass (`tsc` → `dist`) |
| `test` | n/a (E2E recommended) | ✅ **25/25 pass** (new) |

> Note: Git Bash on this machine can't resolve `node` (a known PATH quirk); always run the
> Node toolchain via PowerShell here.

## Issues found → fixes applied

| # | Issue | Severity | Resolution |
| --- | --- | --- | --- |
| 1 | Entire TS rewrite (backend + most of frontend + CI/Docker/Supabase) is **uncommitted**; git HEAD is the old JS prototype | 🔴 Critical | Cleaned the tree (junk removed, blob gitignored, infra captured) and documented; **user must commit** (git left to the user by policy) |
| 2 | OpenRouter API key committed in `backend/.env`, still in **git history** | 🔴 Critical | Documented remediation (rotate + `git filter-repo`); requires the user's key |
| 3 | **DB migration drift** — 5 of 6 live migrations existed only in Supabase | 🟠 High | Captured as `supabase/migrations/0002–0006` |
| 4 | **Edge functions** (`delete-account`, `razorpay-checkout`) not in repo | 🟠 High | Captured under `supabase/functions/*` + README |
| 5 | Committed `0001` migration **missing `audit_logs` INSERT policy** (backend audit writes would fail on a fresh deploy) | 🟠 High | Added `audit_logs_insert_own` |
| 6 | **No automated tests** (`npm test` was a no-op echo) | 🟠 High | Added 25 `node:test` tests (AI normalize, Zod schemas, HTTP envelope); wired into CI |
| 7 | AI call had **no timeout** (hang up to 60s) | 🟡 Medium | `AbortController` timeout (`OPENROUTER_TIMEOUT_MS`) + model failover |
| 8 | Empty `tmpfile`; 5 MB `eng.traineddata` blob eligible for git | 🟡 Medium | Removed / gitignored |
| 9 | `.env.example` implied the backend uses the service-role key | 🟢 Low | Clarified (backend is RLS-only; service role is edge-only) |
| 10 | `avatars` public bucket allows listing (advisor) | 🟢 Low | `0007` hardening migration ready to apply |
| 11 | Leaked-password protection disabled (advisor) | 🟢 Low | Documented dashboard enablement |

## Remaining risks (owner actions)

1. 🔴 **Commit the working tree** and remove the stale JS prototype — the deployed product is
   not in version control.
2. 🔴 **Rotate the OpenRouter key** and scrub git history before sharing the repo.
3. 🟠 Keep the repo as the DB source of truth (apply migrations via CLI, not the dashboard).
4. 🟡 Enable leaked-password protection; apply `0007`; add gitleaks + authz/RLS/E2E tests.
5. 🟡 Before scaling to multiple backend instances: shared rate-limit store + a tamper-proof
   `consume_scan()` for daily metering.
6. 🟡 Run image scanners (OCR) on the container host, not Vercel serverless.

## Accepted-by-design (not defects)

- `app_verify_api_key` / `app_record_api_scan` callable by anon/authenticated — this *is* the
  API-key auth path; the key hash is the authorization, re-verified inside with a locked
  `search_path`. Not exploitable without a valid key hash.
- Dev auth bypass — non-production only; returns 503 in production if Supabase is unconfigured.

## Scorecard

| Dimension | Score | Rationale |
| --- | --- | --- |
| **Production readiness** | **8.5 / 10** | Code, security, and deploy are production-grade; the gating items are commit + key rotation (hygiene, not code) |
| **Security** | **8.5 / 10** | RLS everywhere, defence-in-depth, hashed keys, hardened headers/RPCs. −1.5 for the historical secret + a couple of WARN advisors |
| **Code quality** | **9 / 10** | Strict TS, clean layering, small focused modules, good docstrings, uniform envelope, now type-check/lint/build/test green |
| **Scalability** | **8 / 10** | Stateless API, indexed RLS DB; −2 for per-instance rate-limit state and client-side dashboard aggregation to revisit at scale |
| **Test coverage** | **6.5 / 10** | New backend unit + API suite (highest-risk logic); −3.5 until authz/RLS + E2E land |
| **Documentation** | **9.5 / 10** | This `docs/` set + `DECISIONS.md` + READMEs cover every layer |

**Overall: production-ready pending two owner actions** — commit the code and rotate the
leaked key. Everything else is hardening, captured above and in the per-phase docs.

## Artifacts produced by this audit

- `docs/`: project-audit, frontend, backend, database, authentication, security, ai-system,
  testing, devops, deployment, performance, PROJECT_BLUEPRINT, this report.
- `supabase/migrations/0002–0007` + `supabase/functions/{delete-account,razorpay-checkout}`.
- `backend/tests/*` (25 tests) + real `npm test`.
- Code: AI timeout/failover; exported testable helpers; `.gitignore` + `.env.example`
  hygiene; `0001` audit-insert policy fix; README rewrite.
