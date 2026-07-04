# Neural Shield AI — API Security

> Per-endpoint security review of the Express API (`/api/*`). Date: 2026-07-04.
> Base URL (prod): `https://backend-one-gamma-9n6duzcmcq.vercel.app`. All routes mount under `/api`.

---

## 1. Global controls (apply to every request)

- **`trust proxy = 1`** so rate limiting and `req.ip` see the real client behind Vercel.
- **Helmet** — CSP `default-src 'self'`, `connect-src 'self' https://openrouter.ai`,
  `img-src 'self' data:`, cross-origin resource policy.
- **CORS** — allow-list from `APP_URL` + `FRONTEND_URL`; browser extensions always allowed;
  no-Origin (curl/health) allowed; **fails closed in production** when the allow-list is empty.
- **Body limits** — `express.json({ limit: '1mb' })`; multipart via multer capped at 10 MB.
- **Rate limits** — global 100 / 15 min per IP; scan 30 / 15 min per user-or-IP;
  extension 60 / min; reputation 120 / min.
- **Validation** — `validateBody(schema)` runs Zod; 400 with flattened errors; text inputs strip
  HTML tags.
- **Auth** — `authenticate` resolves a Supabase JWT or an `nsk_` API key (SHA-256 → RPC verify);
  dev bypass only when Supabase is unconfigured **and** not production.
- **Errors** — central `errorHandler` returns the standard envelope; no stack traces to clients.
- **Per-user quotas** — enforced via `app_consume_scan_quota` RPC (atomic, un-bypassable as of
  migration 0013).

---

## 2. Endpoint-by-endpoint

| Endpoint | Auth | Authz | Validation | Rate | Notes / residual |
|---|---|---|---|---|---|
| `GET /api/health` | none | public | — | global | Returns only booleans (AI/Supabase configured). No secret leakage. |
| `POST /api/scan/message` | JWT/key | any (key→Pro) | Zod `{text 10–5000}` | scan+quota | HTML stripped; input persisted under RLS. |
| `POST /api/scan/url` | JWT/key | any | Zod URL ≤2048 | scan+quota | ⚠️ redirect collector: add SSRF denylist before direct fetch. |
| `POST /api/scan/email` | JWT/key | any | Zod body | scan+quota | Concatenated safely; no header injection into mail (no mail send). |
| `POST /api/scan/phone` | JWT/key | any | Zod Indian format | scan+quota | — |
| `POST /api/scan/upi` | JWT/key | any | Zod `name@psp` | scan+quota | — |
| `POST /api/scan/screenshot` | JWT | **Pro** | multer image ≤10 MB | scan+quota | OCR; Pro-gated by `requirePlan(['pro'])`. |
| `POST /api/scan/qr` | JWT | **Pro** | multer image ≤10 MB | scan+quota | QR decode; Pro-gated. |
| `POST /api/report` | JWT only | any | Zod entity fields | scan | API keys get 403 (report requires a real user). |
| `GET /api/reputation/:type/:value` | none | public | path params | reputation 120/min | Read-only aggregate; time-decayed; no PII returned. |
| `GET /api/extension/config` | none | public | — | extension 60/min | Static config (version, thresholds). |
| `POST /api/extension/analyze` | JWT/key | any | Zod `entities ≤10` | extension 60/min | Batch; skips LLM explanation (cheap). |
| `GET /api/admin/stats` | JWT | admin | — | global | RPC re-checks `admin_is_admin()`. |
| `GET /api/admin/users` | JWT | admin | query filters | global | Pagination bounded server-side. |
| `GET /api/admin/users/:id` | JWT | admin | — | global | — |
| `GET /api/admin/scans` | JWT | admin | filters | global | Input truncated to 120 chars in the response. |
| `GET /api/admin/feedback` | JWT | admin | limit/offset | global | — |
| `GET /api/admin/logs` | JWT | admin | limit/offset | global | — |
| `GET /api/admin/payments` | JWT | admin | `?status` | global | — |
| `POST /api/admin/payments/:id/approve` | JWT | admin | — | global | Sets plan + resets counters via RPC; logged to `admin_logs`. |
| `POST /api/admin/payments/:id/reject` | JWT | admin | `{note?}` | global | Logged. |

---

## 3. Response hygiene

- Standard envelopes: `{ success, message, data, timestamp }` / `{ success, message, details }`.
- Errors are generic to clients (`"Analysis failed. Please try again."`); details are logged
  server-side only. Quota breaches return `429` with a machine-readable `DAILY_LIMIT_EXCEEDED`
  code so the UI can react without parsing prose.
- Admin scan listing truncates raw input to 120 chars to limit sensitive-data exposure in the
  console.

---

## 4. Recommendations (non-blocking)

1. **SSRF denylist** for the redirect collector before it fetches user URLs directly (RFC-1918 /
   loopback / link-local / `169.254.169.254`, HTTP(S) only).
2. **Auth-form anti-automation** — CAPTCHA + lockout on repeated failures (Supabase gives a
   baseline; add app-level friction).
3. **Pagination hard caps** — confirm `limit` is clamped (e.g., ≤100) on all admin list endpoints.
4. **Structured audit on admin mutations** — already logged; add alerting (see `monitoring.md`).
5. **API-key scopes / rotation UX** — currently create/revoke; consider per-key rate limits and
   last-used display (already stored) surfaced to the user.

Overall API posture: **strong**. Every state-changing endpoint is authenticated, authorized,
validated, and rate-limited; sensitive data is scoped by RLS and truncated in privileged views.
