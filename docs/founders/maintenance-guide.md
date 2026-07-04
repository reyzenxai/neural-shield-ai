# Maintenance Guide

> Routine upkeep so the product stays healthy and secure. None of this is urgent day-to-day, but
> skipping it for months creates risk and toil.

## Cadence at a glance

| Frequency | Task |
|---|---|
| On every deploy | Run the [deployment.md](deployment.md) checklist; confirm CI is green; smoke-test. |
| Weekly | Skim Sentry for new error types; check Vercel function error rate. |
| Monthly | `npm audit` / dependency review; run Supabase Advisors; review admin access. |
| Quarterly | Rotate secrets; test a database restore; review rate limits + quotas. |
| As needed | Tune the scoring matrix (bump `ENGINE_VERSION`); add threat-intel keys. |

## Dependencies

- Add `npm audit --audit-level=high` (and `depcheck`) to CI — currently a gap.
- Upgrade `multer@1.4.5-lts.1` and `jimp@0.22` (older major lines) when convenient; run the backend
  test suite after.
- Runtime-critical deps (`next`, `react`, `@supabase/*`, `express`) are current — upgrade
  deliberately and test.

## Database

- **Migrations are immutable** — never edit an old one; add a new numbered file. Apply with
  `supabase db push`.
- **Backups:** confirm the Supabase plan has the retention you need; **test a restore** at least
  quarterly (a backup you've never restored is a hope, not a backup).
- **Advisors:** run Security + Performance advisors monthly; add indexes they suggest.
- **Undoing migration 0013** (if ever needed): re-grant the counter columns to `authenticated` and
  `drop function app_consume_scan_quota` — but the backend then meters via the legacy path and users
  can reset counters again, so prefer to fix forward.

## Secrets

- Rotate `OPENROUTER_API_KEY`, Supabase keys, and any collector keys on a schedule and after any
  suspected exposure.
- Never commit `.env`; keep them gitignored. Store secrets in Vercel/Supabase env.
- **First priority:** rotate the historically-leaked OpenRouter key (see [security.md](security.md)).

## The engine

- Weight/threshold tuning lives in `backend/src/threat-engine/config/weights.ts` — **data, not
  logic**. When you change it, **bump `ENGINE_VERSION`** so old verdicts stay reproducible, and keep
  the scoring-matrix regression test green.
- Keep the two plan-limit sources of truth in sync: `packages/config` `PLANS` and
  `backend/src/config/plans.ts` (a future improvement is to generate one from the other).

## Threat-intel coverage

- Configure `GSB_API_KEY` (→ **Web Risk** for commercial use), `VIRUSTOTAL_API_KEY`,
  `ABUSEIPDB_API_KEY` to raise detection coverage. Unset keys silently lower confidence.

## Documentation hygiene

- When you change architecture, update `../../context.md` **and** the relevant founder doc in this
  folder. The repo should stay self-documenting (that's a stated project value).

## OCR reliability
- If screenshot/QR scanning matters, run the backend on a container host (`backend/Dockerfile`) —
  Tesseract is unreliable on Vercel serverless.
