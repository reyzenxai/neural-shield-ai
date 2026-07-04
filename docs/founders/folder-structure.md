# Folder Structure

This is an **npm workspaces monorepo**. The root `package.json` declares `frontend`, `backend`,
and `packages/*` as workspaces. `mobile/` and `extension/` are deliberately **excluded** from the
workspace (they pin their own React/build tooling and would break under dependency hoisting).

```
/
├── frontend/              # Next.js 16 web app (THE launch product)
│   └── src/
│       ├── app/           # App Router pages (landing, auth, dashboard, admin, api/og)
│       ├── components/    # ui/, scanner/, profile/, landing/, layout/, auth/, dashboard/
│       ├── hooks/         # useAuth, useScans, useScanner (React Query)
│       ├── lib/           # api client, supabase clients, scans/profile/payments/members…
│       ├── store/         # Zustand auth/session store (useAppStore)
│       └── proxy.ts       # Next 16 route guard (was middleware.ts)
├── backend/               # Express + TypeScript API + Trust Engine v2
│   ├── api/index.ts       # Vercel serverless entry (exports the Express app)
│   └── src/
│       ├── app.ts         # Express factory: Helmet, CORS, rate limit, routes
│       ├── server.ts      # Long-running process entry (app.listen)
│       ├── routes/        # health, scan, report, reputation, extension, admin
│       ├── controllers/   # thin request handlers
│       ├── middleware/    # auth, rateLimit, validate, upload, error
│       ├── services/      # ai, scan, extract (OCR/QR), supabase
│       ├── threat-engine/ # THE engine: index, risk, rules, normalize, collectors/, intel/, config/
│       ├── config/        # env config + plans (backend copy)
│       └── ml/            # intentional placeholder (roadmap)
├── packages/              # shared workspace packages
│   ├── types/             # @neural-shield/types (scan contract, declaration-only)
│   ├── config/            # @neural-shield/config (PLANS catalog — pricing/quota source of truth)
│   ├── validation/        # @neural-shield/validation (shared Zod schemas)
│   └── sdk/               # @neural-shield/sdk (runtime-agnostic scan API client)
├── mobile/                # Expo / React Native (Android-first) — Priority 3
├── extension/             # Chrome MV3 extension — Priority 3
├── supabase/
│   ├── migrations/        # 0001..0013 SQL (schema + RLS + SECURITY DEFINER RPCs)
│   └── functions/         # edge functions: delete-account, razorpay-checkout
├── infrastructure/n8n/    # self-hosted n8n docker-compose + env template (setup only)
├── docs/                  # ~50 docs incl. docs/nsie/* (ML design) + founders/ (this set)
├── .github/workflows/     # CI (type-check, lint, test, build)
├── docker-compose.dev.yml # local full-stack dev
├── DECISIONS.md           # architecture decision log (D1..D9)
├── context.md             # THE architectural source of truth
└── README.md
```

## Key files to know

| File | Why it matters |
|---|---|
| `backend/src/threat-engine/index.ts` | The engine orchestrator — the heart of the product. |
| `backend/src/threat-engine/risk.ts` | The **only** place numbers are produced. |
| `backend/src/threat-engine/config/weights.ts` | Versioned scoring matrix (weights as data). |
| `backend/src/services/ai.service.ts` | OpenRouter client + explainer + templated fallback. |
| `backend/src/middleware/auth.middleware.ts` | JWT + API-key auth, plan/admin guards. |
| `packages/config/index.ts` | Plans catalog — single source of truth for pricing/quotas. |
| `supabase/migrations/*` | The full evolving schema + RLS + privileged functions. |
| `frontend/src/store/useAppStore.ts` | Web auth/session/profile state. |

## A note on migration numbering

Some migration numbers appear twice (e.g., two `0008` files). That's expected: migrations are
append-only and immutable, and a "week N" engine slice and a "phase N" product slice were authored
in parallel. The newest logical migration is `0013_scan_quota_consume_function.sql`.
