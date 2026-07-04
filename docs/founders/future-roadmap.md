# Future Roadmap

> Where the product is heading, kept separate from what's shipped today. Nothing here is a current
> defect — it's planned architecture. Mirrors `../../context.md` §26 and `../security-roadmap.md`.

## Detection

- **NSIE v3 — learned models.** ONNX-served models fused into the deterministic engine as
  *additional signals* (never the final word), via a confidence engine + threat-fusion layer, with
  an MLOps + continuous-learning pipeline feeding on `scan_signals` + community `reports`. The
  deterministic path stays the source of truth. Design: `docs/nsie/*`. See [ml-engine.md](ml-engine.md).
- **Persistent cross-instance intel cache.** Fully wire `entity_intel` (verdict-aware TTL cache) to
  replace the in-process cache, plus a reputation graph over
  `domains/urls/emails/phone_numbers/upi_ids`.
- **Wider threat-intel coverage.** Google **Web Risk** (commercial), more feeds, better calibration.

## Security (see `../security-roadmap.md` for sequencing)

- Cloudflare WAF/DDoS/DNSSEC in front of a custom domain.
- SSRF denylist before any direct user-URL fetch; frontend CSP; auth anti-automation
  (CAPTCHA/lockout); dependency-audit in CI; richer monitoring/alerting.

## Payments & growth

- **Automated payment gateway** to replace manual UPI approval (reactivate/replace the dormant
  Razorpay path — prices are already catalog-correct).
- Newsletter automation maturity: double opt-in, unsubscribe handling, segmented campaigns
  (see [automation-workflows.md](automation-workflows.md)).

## Platform & code health

- **Adopt `@neural-shield/sdk`** across mobile + extension (and, with a build step, the backend) to
  kill client duplication and contract drift.
- **Unify plan limits** to one source of truth (generate `backend/src/config/plans.ts` from
  `packages/config`).
- **Container host for the backend** (reliable OCR).
- **Physical monorepo restructure** (`frontend → apps/web`, etc.) — staged in
  `docs/migration-guide.md`; deferred because it needs manual Vercel root-dir / EAS / extension-build
  changes.
- **E2E test suite** for web/mobile/extension (backend already has ~195 tests).

## Product surfaces

- Mobile: fix contract drift, then invest (cert pinning, tamper/root detection) — see
  [android.md](android.md).
- Extension: production API URL config, tighter permissions, Web Store publish — see
  [chrome-extension.md](chrome-extension.md).

## Guiding principle

Every future addition must preserve the two invariants that make this product defensible:
**deterministic, auditable scoring** and **no ambient super-user credential in the backend**. Add
capability around those constraints, not through them.
