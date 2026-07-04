# API Reference

> Express API. Base URL (prod): `https://backend-one-gamma-9n6duzcmcq.vercel.app`, everything under
> `/api`. Auth: Supabase JWT (`Authorization: Bearer <token>`) or `X-API-Key: nsk_...` (Pro).
> Envelopes: success `{ success:true, message, data, timestamp }`; error
> `{ success:false, message, details, timestamp }`. See also `../api-security.md`.

## Endpoints

| Method | Path | Auth | Plan | Body / params |
|---|---|---|---|---|
| GET | `/api/health` | none | — | — |
| POST | `/api/scan/message` | JWT/key | any (key→Pro) | `{ text }` (10–5000) |
| POST | `/api/scan/url` | JWT/key | any | `{ url }` (valid URL ≤2048) |
| POST | `/api/scan/email` | JWT/key | any | `{ subject?, body, sender? }` |
| POST | `/api/scan/phone` | JWT/key | any | `{ phone }` (Indian format) |
| POST | `/api/scan/upi` | JWT/key | any | `{ upiId }` (`name@psp`) |
| POST | `/api/scan/screenshot` | JWT | **Pro** | multipart `file` (image) |
| POST | `/api/scan/qr` | JWT | **Pro** | multipart `file` (image) |
| POST | `/api/report` | JWT only | any | `{ entityType, entityValue, reportType, notes? }` |
| GET | `/api/reputation/:type/:value` | none | — | path params |
| GET | `/api/extension/config` | none | — | — |
| POST | `/api/extension/analyze` | JWT/key | any | `{ entities: [{type,value}] }` (≤10) |
| GET | `/api/admin/stats` | JWT | admin | — |
| GET | `/api/admin/users` | JWT | admin | `limit, offset, search, plan, sort_*` |
| GET | `/api/admin/users/:id` | JWT | admin | — |
| GET | `/api/admin/scans` | JWT | admin | filters (input truncated to 120 chars) |
| GET | `/api/admin/feedback` | JWT | admin | `limit, offset` |
| GET | `/api/admin/logs` | JWT | admin | `limit, offset` |
| GET | `/api/admin/payments` | JWT | admin | `?status=pending` |
| POST | `/api/admin/payments/:id/approve` | JWT | admin | — |
| POST | `/api/admin/payments/:id/reject` | JWT | admin | `{ note? }` |

## Verdict shape (scan responses)

A saved scan returns (among other fields): `scamProbability` (0–1), `trustScore` (0–100),
`riskLevel` (`safe|low|medium|high|critical`), `confidence`, `scamType`, `flags[]`, `signals[]`
(v2 evidence trail), `engineVersion`, `scanId`, `createdAt`. Image scans also return
`extractedText` / `decodedText`.

## Error codes

`400` validation/bad request · `401` missing/invalid token or API key · `403` plan/admin gate or
report-via-API-key · `422` OCR/QR could not extract · `429` quota (`code: DAILY_LIMIT_EXCEEDED`) or
rate limit · `500` internal/RPC failure · `502` analysis failed (all models failed) · `503` server
auth / reputation not configured.

## Rate limits

Global 100 / 15 min per IP · scan 30 / 15 min per user-or-IP · extension 60 / min · reputation
120 / min. Per-user scan quotas are separate and plan-based (see [authorization.md](authorization.md)).

## Example (API key)

```bash
curl -X POST https://backend-one-gamma-9n6duzcmcq.vercel.app/api/scan/message \
  -H "X-API-Key: nsk_live_..." \
  -H "Content-Type: application/json" \
  -d '{"text":"Your account will be blocked, verify KYC at bit.ly/x"}'
```

## Notes

- API keys require the **Pro** plan and cannot submit reports (`/api/report` needs a JWT).
- The extension `/analyze` endpoint skips the LLM explanation for speed/cost.
- Admin endpoints are double-guarded: `requireAdmin()` in Express **and** an `admin_is_admin()`
  re-check inside each admin RPC.
