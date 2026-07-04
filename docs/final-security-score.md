# Neural Shield AI — Final Security Score

> Consolidated scorecard after the `security/production-hardening` branch. Date: 2026-07-04.
> Scoring is qualitative (0–10 per domain), weighted toward the website launch path.

---

## Scorecard

| Domain | Before | After branch | Notes |
|---|---:|---:|---|
| Access control / authz | 7 | **9** | RLS + RPC re-checks + middleware; quota reset closed |
| Authentication | 9 | **9** | Supabase Auth, server-side validation; CAPTCHA/lockout backlog |
| Injection (SQL/XSS/prompt) | 9 | **9** | Parameterized DB, React escaping, deterministic AI |
| Cryptography / secrets | 6 | **7** | Hashed keys, TLS, HMAC; −points until leaked key rotated |
| Security config | 6 | **8** | CORS fail-closed, Helmet, no dev bypass in prod |
| Data protection | 8 | **8** | RLS, private buckets, truncated admin views |
| API security | 8 | **9** | Every mutating endpoint authn+authz+validated+limited |
| AI security | 9 | **9** | Score is deterministic; LLM is explainer-only |
| Dependencies | 6 | **6** | Add CI audit; upgrade multer/jimp |
| Logging / monitoring | 6 | **6** | Sentry + audit logs; alerting backlog |
| Infrastructure / edge | 6 | **7** | Strong headers; Cloudflare/WAF still owner action |
| SSRF / outbound safety | 6 | **6** | Denylist needed before direct URL fetch |

**Weighted overall (launch path): ~8.3 / 10** (up from ~7.2). A well-architected product whose
residual risk is concentrated in **owner operational tasks** (key rotation, prod env, edge WAF)
rather than code defects.

---

## What moved the needle (this branch)

- Self-service scan-quota reset → **eliminated** (SECURITY DEFINER consume RPC + column revoke).
- CORS arbitrary-origin reflection in prod → **eliminated** (fail-closed).
- Dormant Razorpay mispricing hazard → **eliminated** (catalog-correct prices).
- Complete threat model, OWASP mapping, per-endpoint API review, and founder runbooks →
  the team can now operate and extend securely.

## What still gates a top score

1. **Rotate the leaked OpenRouter key** (Critical, owner) — the single biggest remaining item.
2. **Production env hygiene** (`FRONTEND_URL`, rotated keys, apply migration 0013).
3. **Edge WAF/DDoS via Cloudflare** and **Google Web Risk** for commercial use.
4. **CI dependency audit** + **monitoring/alerting** + **SSRF denylist**.

Complete items 1–2 and the launch path is production-ready; items 3–4 raise the ceiling for a
commercial, high-traffic posture.

---

## Production-readiness verdict (website)

**Ready to launch after the two owner actions (key rotation + prod env / migration apply).** No
open critical or high *code* vulnerability remains in the website/backend path after this branch.
See `security-roadmap.md` for sequencing and `implementation-summary.md` for the post-merge
checklist.
