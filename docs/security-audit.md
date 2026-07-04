# Neural Shield AI — Security Audit

> Full-repository security audit and threat model. Prepared for the website production
> launch. Scope: entire monorepo, with launch-critical weight on web + backend + database
> + auth. Date: 2026-07-04. Branch: `security/production-hardening`. Baseline HEAD: `9758e8b`.

This document is a point-in-time audit. Fixes implemented on this branch are marked
**[FIXED]**; items left for the founder are marked **[OWNER ACTION]** or **[BACKLOG]**.

---

## 1. Executive summary

Neural Shield AI has an unusually strong baseline security posture for its stage. The two
defining decisions — (a) the backend holds **no Supabase service-role key** and operates
under each user's JWT with Row-Level Security enforced at the database, and (b) **every
numeric verdict is deterministic**, with the LLM demoted to an explainer that can never emit
a score — remove entire classes of vulnerability (privilege escalation via a leaked super-user
credential, and prompt-injection-driven score manipulation) by construction.

The audit found **no critical, unmitigated vulnerability in the website/backend path**. The
highest-value issues were: user-updatable scan counters (self-service quota reset), CORS that
could reflect an arbitrary origin if misconfigured, and a dormant Razorpay path that would
mis-price if reactivated. All three are addressed on this branch. The single remaining
**critical owner action** is rotating the historically-leaked OpenRouter key.

Overall residual risk after this branch: **Low–Medium**, gated mostly on owner actions
(key rotation, production env hygiene, moving Google Safe Browsing → Web Risk for commercial use).

---

## 2. Threat model

### 2.1 Assets

| Asset | Sensitivity | Where it lives |
|---|---|---|
| User auth credentials / sessions | Critical | Supabase Auth (`auth.users`), never in app tables |
| User scan history + inputs (may contain PII: phone, UPI, message text) | High | Postgres `scans`, `scan_flags`, `scan_signals` (RLS) |
| Profile data (email, name, plan, notification prefs) | Medium | `profiles` (RLS) |
| API keys (Pro) | High | `api_keys` — **SHA-256 hash only**, raw shown once |
| Payment proofs (UPI screenshots) | High | Storage `payment-proofs` (private, own-folder + admin) |
| Admin capability | Critical | `profiles.is_admin`, guarded by RPC + middleware |
| Third-party API keys (OpenRouter, GSB, VT, AbuseIPDB) | High | Server env only (Vercel), never client |
| Supabase service-role key | Critical | **Edge functions only** — not in the Express backend |
| Trust-engine scoring matrix | Medium (IP) | `backend/src/threat-engine/config/weights.ts` |

### 2.2 Trust boundaries

1. **Browser/extension/mobile → Express API** — crosses from untrusted client to server. Auth
   (JWT or API key), Zod validation, rate limits, CORS at this boundary.
2. **Express API → Postgres** — the API acts *as the user* (RLS). Privileged reads/writes only
   via `SECURITY DEFINER` RPCs. No ambient super-user.
3. **Express API → OpenRouter / threat-intel** — outbound to third parties; the scanned input is
   treated as **untrusted context** in prompts; collectors fail open.
4. **Client → Supabase (direct)** — dashboard/history/profile reads go straight to Postgres under
   RLS; auth via Supabase JS.
5. **Edge functions → Postgres (service role)** — the only place the service role is used; each
   function verifies the JWT / HMAC signature first.

### 2.3 Threat actors

- **Unauthenticated internet attacker** — hits public endpoints (`/health`, `/reputation`,
  `/extension/config`, landing, subscribe). Goal: data exfiltration, abuse, DoS.
- **Authenticated malicious user** — has a valid session. Goal: escalate plan, reset quotas,
  read others' data (IDOR), abuse AI/token budget.
- **Compromised API-key holder (Pro)** — Goal: abuse programmatic scan access.
- **Insider / leaked secret** — Goal: use a leaked key (e.g., OpenRouter) for free inference.
- **Automated bot / scraper** — Goal: quota abuse, credential stuffing on auth.

### 2.4 Primary attack surfaces

- Express API (`/api/*`) — 21 endpoints.
- Supabase RLS surface (direct client reads) + Storage buckets.
- Supabase edge functions (`delete-account`, `razorpay-checkout`).
- Landing page inputs (subscribe email, demo analyzer — client-only).
- OAuth callback (`/auth/callback`).
- Extension content script (runs on every page — no network I/O, low surface).

### 2.5 Data-flow risk notes

- Scanned inputs can contain PII and are persisted. They are only ever readable by their owner
  (RLS) or an admin (via gated RPC, input truncated to 120 chars in admin scan list).
- The scanned input is passed to OpenRouter for explanation. This is an **outbound data flow to a
  third party** — see `ai-security.md` and the privacy policy. It is the one place user content
  leaves the trust boundary; it should be disclosed to users (it is, in the privacy page).

---

## 3. Findings

Ranked by residual risk. Severity reflects likelihood × impact **for the website/backend**.

### 3.1 [FIXED] Self-service scan-quota reset — *High → Resolved*

**Was:** migration 0008 granted `authenticated` UPDATE on `daily_scan_count` /
`monthly_scan_count` so the backend could meter under RLS. A user with a valid session could
`UPDATE profiles SET daily_scan_count = 0` and bypass their plan quota (business-logic /
broken-access-control flaw; also a cost issue — each scan consumes AI + intel budget).

**Fix (this branch):** migration `0013_scan_quota_consume_function.sql` adds
`app_consume_scan_quota(daily, monthly)` — a `SECURITY DEFINER` function (locked `search_path`,
`SELECT … FOR UPDATE`) that enforces the cap and increments atomically for `auth.uid()`. The
counter columns are **revoked** from client UPDATE. `scan.service.checkAndConsumeLimits` calls
the RPC and only falls back to the legacy path if the function is not yet deployed (safe
migration window). Race conditions between concurrent scans are also closed by the row lock.

### 3.2 [FIXED] CORS could reflect an arbitrary origin — *Medium → Resolved*

**Was:** if the CORS allow-list resolved empty (e.g., `APP_URL`/`FRONTEND_URL` unset in prod),
the handler reflected **any** origin with `credentials: true`. Combined with cookies/JWT this is
a CSRF/data-exposure risk.

**Fix (this branch):** `app.ts` now fails closed in production — an empty allow-list denies
cross-origin requests when `NODE_ENV=production`; dev keeps the permissive behavior.
**[OWNER ACTION]** still set `FRONTEND_URL` in prod so the real frontend origin is allow-listed.

### 3.3 [FIXED] Dormant Razorpay path would mis-price — *Medium → Resolved*

**Was:** `razorpay-checkout` `PRICES` referenced a removed `business` plan and a stale `pro`
price (₹299 where the catalog says ₹499). If reactivated as-is it would sell Pro at the wrong
price and offer a non-existent plan.

**Fix (this branch):** `PRICES` now mirrors the current catalog (individual/two_person/family/pro
in paise) and the `business` key is removed. The path remains dormant (503 until secrets set).

### 3.4 [OWNER ACTION] Leaked OpenRouter key in git history — *Critical (operational)*

A previously-committed `backend/.env` OpenRouter key exists in history. **Rotate the key in the
OpenRouter dashboard and confirm history is scrubbed before sharing the repo externally.** The
key grants paid inference; it is explanation-only in the app (an attacker cannot change verdicts),
but it is a billable secret. See `security-roadmap.md` §Critical.

### 3.5 [OWNER ACTION] Google Safe Browsing is non-commercial — *Medium (compliance)*

The free GSB API is non-commercial. A commercial launch must migrate the `gsb` collector to
**Google Web Risk** (paid). Until then, GSB is a licensing risk, not a technical vulnerability.

### 3.6 [BACKLOG] Third-party image dependency on the payment page — *Low*

`api.qrserver.com` renders the UPI QR. A third-party outage/compromise affects the upgrade page
only (the QR encodes a local `upi://` string; no secret is sent). Consider generating the QR
locally (e.g., a small QR lib) to remove the dependency.

### 3.7 [BACKLOG] Key-gated collectors silently lower coverage — *Low*

With `GSB_API_KEY` / `VIRUSTOTAL_API_KEY` / `ABUSEIPDB_API_KEY` unset, those collectors are
skipped and confidence drops silently. This is *fail-open by design* but should be surfaced in
admin/monitoring so the team knows detection coverage is degraded.

### 3.8 [BACKLOG] Mobile ↔ backend contract drift — *Low (mobile is Priority 3)*

`mobile/lib/api.ts` uses form field `image` (backend expects `file`), posts a feedback shape
`/api/report` rejects, and reads `scans` columns not in tracked migrations. Not a website
blocker; documented for the mobile workstream (see `context.md` §24).

---

## 4. Simulated penetration test

Each scenario lists attack → impact → likelihood → mitigation (current state).

| # | Scenario | Impact | Likelihood | Mitigation |
|---|---|---|---|---|
| P1 | Authed user resets own scan counter to bypass quota | Med (cost/abuse) | Was High | **Fixed** — counters revoked; RPC-only atomic consume (§3.1) |
| P2 | User tries to set `profiles.plan = 'pro'` directly | High | Low | `plan` UPDATE revoked (migration 0006); verified `42501` |
| P3 | User reads another user's scans (IDOR) via API or direct | High | Low | RLS on every table keys on `auth.uid()`; API acts as user |
| P4 | Non-admin calls `/api/admin/*` | High | Low | `requireAdmin()` middleware **and** admin RPCs re-check `admin_is_admin()` (defense in depth) |
| P5 | Prompt injection in scanned text flips the verdict | High | Very Low | LLM cannot emit numbers; input passed as untrusted context (§ai-security) |
| P6 | Forged/expired JWT | High | Low | `supabase.auth.getUser(token)` validates server-side each request |
| P7 | API key brute force | Med | Low | Keys are 256-bit random, stored as SHA-256; rate limits apply; Pro-gated |
| P8 | CSRF against the API using a victim's cookies | Med | Low | API auth is Bearer JWT / `X-API-Key` (not cookies); CORS fail-closed in prod (§3.2) |
| P9 | XSS in dashboard/history rendering scan content | High | Low | React auto-escaping; no `dangerouslySetInnerHTML` on user content; Zod strips HTML tags server-side |
| P10 | DoS via large payloads / floods | Med | Med | `express.json({ limit: '1mb' })`, multer 10 MB, global + per-route rate limits; Vercel edge in front. **[BACKLOG]** add WAF/Cloudflare (§infrastructure) |
| P11 | SSRF via URL scan collectors resolving internal hosts | Med | Low–Med | Collectors are timeboxed/fail-open and query public intel APIs; RDAP/DNS/TLS operate on the hostname. **[BACKLOG]** add explicit private-IP/localhost denylist before any direct fetch of user URLs |
| P12 | Abuse of AI token budget by mass scanning | Med (cost) | Med | Per-user quotas (now un-bypassable), per-model timeout, fallback to templated text |
| P13 | Open redirect via OAuth callback | Med | Low | Supabase-managed code exchange; redirect targets are app-internal |
| P14 | Credential stuffing on login | Med | Med | Supabase Auth rate-limits; **[BACKLOG]** consider CAPTCHA + account lockout policy |

**Notable gap to close (non-blocking): P11 SSRF.** Before adding any collector that fetches a
user-supplied URL *directly* (the redirect collector), enforce a denylist for RFC-1918 /
loopback / link-local / metadata (`169.254.169.254`) addresses and disallow non-HTTP schemes.
Tracked in `security-roadmap.md`.

---

## 5. Layer-by-layer audit summary

- **Frontend:** React auto-escaping, no dangerous HTML sinks on user data, tokens held by
  Supabase SDK (not hand-rolled localStorage), env split into `NEXT_PUBLIC_*` (public) vs server.
  Security headers set in `next.config.ts` + `vercel.json`. **OK.**
- **Backend:** Helmet CSP, fail-closed CORS (now), rate limits, Zod validation, size limits,
  centralized error handler that returns clean messages (no stack leakage). **OK.**
- **Database:** RLS everywhere, `SECURITY DEFINER` RPCs with locked `search_path` and internal
  authz re-checks, hashed API keys, private storage buckets with own-folder policies. **Strong.**
- **Auth:** native Supabase Auth (no custom JWT/bcrypt), server-side token validation, dev bypass
  hard-disabled in prod. **Strong.**
- **AI:** deterministic scoring; LLM explainer with injection guards and templated fallback.
  **Strong.**
- **Edge functions:** service-role isolated here; JWT + HMAC verification. Razorpay pricing fixed.
  **OK.**
- **Infra/CI:** GitHub Actions type-check/lint/test/build; Vercel deploy. No secrets in tree.
  **OK** — add `npm audit`/`depcheck` step (backlog).

See `owasp-report.md` for the OWASP Top 10 mapping and `api-security.md` for per-endpoint detail.

---

## 6. Post-branch residual risk register

| Risk | Owner | Severity | Status |
|---|---|---|---|
| Leaked OpenRouter key in history | Founder | Critical (ops) | Open — rotate |
| Prod env hygiene (`FRONTEND_URL`, keys) | Founder | Medium | Open — checklist in `deployment.md` |
| GSB → Web Risk for commercial use | Founder | Medium | Open |
| SSRF denylist before direct URL fetch | Eng | Medium | Backlog |
| WAF / DDoS (Cloudflare) | Founder/Eng | Medium | Backlog (`infrastructure-security.md`) |
| Auth abuse (CAPTCHA/lockout) | Eng | Low–Med | Backlog |
| Mobile contract drift | Mobile eng | Low | Backlog |

---

*End of security audit.*
