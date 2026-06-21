# Security Review — Neural Shield AI

OWASP-oriented review of the app, backend, database, and AI surface. Severity reflects
residual risk **after** the fixes in this audit.

## Controls already in place (verified in code)

| Area | Control |
| --- | --- |
| Secure headers | Helmet (CSP, frameguard, nosniff, etc.) on the API; `next.config.ts` `headers()` (HSTS, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy) on the app, mirrored in `vercel.json` |
| CSP | `default-src 'self'`, `connect-src 'self' https://openrouter.ai`, `img-src 'self' data:` |
| CORS | explicit allow-list (`APP_URL`, `FRONTEND_URL`); credentials enabled |
| Input validation | Zod on every text route; trims + strips HTML tags; length/format bounds |
| Upload safety | multer memory storage, 10 MB cap, mime allow-list (png/jpg/webp) |
| Rate limiting | global 100/15min per IP + scan 30/15min per user/IP; free-tier daily cap |
| AuthZ | Supabase JWT verify; plan gates; **RLS on every table** |
| Secret minimization | backend has **no service-role key**; secrets isolated in edge functions; API keys stored as SHA-256 hashes only |
| Error hygiene | central handler logs internally, returns generic messages |
| SECURITY DEFINER hygiene | `search_path` pinned to `''`, schema-qualified refs, EXECUTE revoked where not needed |

## OWASP / threat checklist

| Threat | Status | Notes |
| --- | --- | --- |
| **Injection (SQL)** | ✅ Low | No raw SQL in app code; supabase-js parameterizes; RPCs are plpgsql with typed args |
| **XSS** | ✅ Low | React escapes by default; no `dangerouslySetInnerHTML`; Zod strips tags from inputs; CSP |
| **CSRF** | ✅ Low | API is token-bearer (not cookie-auth for state-changing calls); Supabase cookies are SameSite |
| **SSRF** | ⚠️ Low–Med | URL/QR scanners send user URLs to the LLM as **text** (no server-side fetch), so no classic SSRF. If a future feature fetches the URL server-side, add allow-listing + block private ranges |
| **Prompt injection** | ⚠️ Medium | Content is analyzed, so adversarial text can try to steer the model. Mitigations: fixed system prompt, JSON-mode, strict output normalization (untrusted text can't change the response *shape*), low temperature. Residual: a crafted message could bias the *score*. See [ai-system.md](ai-system.md) |
| **Open redirect** | ✅ Low | `proxy.ts` redirects only to fixed internal paths; the `redirect` param is used as a path, not an absolute URL |
| **Secrets exposure** | 🔴 **Action required** | The OpenRouter key was committed in `backend/.env` and **remains in git history**. Rotate the key and scrub history before sharing the repo |
| **Broken access control** | ✅ Low | RLS + plan gates + revoked self-`plan` UPDATE; verified a direct plan UPDATE returns `42501` |
| **Rate limiting / DoS** | ⚠️ Low–Med | App-level limits present; limiter state is in-memory per instance — use a shared store if scaling to multiple backend instances |
| **Sensitive data at rest** | ✅ Low | No card data (Razorpay-hosted); API keys hashed; passwords in Supabase |
| **Auth misconfig** | ⚠️ Low | Enable leaked-password protection (below) |

## Findings & fixes applied in this audit

1. **Missing `audit_logs` INSERT policy (committed migration).** The backend writes audit
   rows under the user's JWT; without the INSERT policy, audit logging silently fails on a
   fresh deploy. **Fixed** in `0001_init.sql` (`audit_logs_insert_own`).
2. **AI call had no timeout** — a hung upstream call blocked up to the 60s function ceiling
   (availability risk). **Fixed**: `AbortController` timeout + model failover.
3. **5 MB `eng.traineddata` blob + empty `tmpfile`** in the tree. **Fixed**: gitignored /
   removed.
4. **DB/edge drift** — privileged RPCs and edge functions lived only in the live project
   (un-reviewable, un-versioned). **Fixed**: captured as migrations + function source.

## Supabase advisor findings

Run: Supabase → Advisors (or `get_advisors`). Current results:

| Finding | Level | Disposition |
| --- | --- | --- |
| `app_verify_api_key` / `app_record_api_scan` executable by anon/authenticated | WARN | **Accepted by design** — these *are* the API-key auth path; possession of the key hash is the authorization, re-verified inside each function with a locked `search_path`. Not exploitable without a valid key hash. |
| `avatars` public bucket allows listing | WARN | **Fix ready** — `0007_harden_avatars_bucket_listing.sql` drops the broad SELECT (avatars are served by public URL, not `list()`). Apply to close. |
| Leaked-password protection disabled | WARN | **Action**: enable in Auth → Policies (HaveIBeenPwned check). Dashboard toggle, no code change. |

[Advisor remediation docs](https://supabase.com/docs/guides/database/database-linter)

## Remaining risks / recommended follow-ups

- 🔴 **Rotate the OpenRouter key and scrub git history** (`git filter-repo --path backend/.env
  --invert-paths`), then force-push if the repo is shared. Highest residual risk.
- ⚠️ Enable leaked-password protection; apply `0007` bucket hardening.
- ⚠️ Move rate-limit + daily-metering state to a shared store (Upstash Redis) before scaling
  horizontally; move metering into a SECURITY DEFINER `consume_scan()` so free users cannot
  reset their own counter.
- ⚠️ Add a strict CSP to the **frontend** (currently the security headers cover framing/HSTS;
  a full app CSP with nonces is a hardening step for the Next app).
- ℹ️ Consider a secret scanner (gitleaks) in CI to prevent re-introducing committed secrets.
