# Folder Structure

This covers two things: the layout the repository has today, and the monorepo layout it is moving toward. The point of writing both down is so the migration has a clear before and after, and so nobody has to guess where a file is supposed to live.

## Today

```
neural-shield-ai/
├── frontend/                Next.js web app (App Router, React 19, Tailwind v4)
│   └── src/{app,components,hooks,lib,services,store,types}, proxy.ts
├── backend/                 Express + TypeScript API and detection engine
│   ├── src/
│   │   ├── controllers/     scan, admin, extension, report, reputation
│   │   ├── routes/          one file per controller, plus health
│   │   ├── engine/          rules, collectors, intel, risk, reputation, cache, net
│   │   ├── middleware/      auth, validate, rate limit, upload, error
│   │   ├── schemas/         Zod request schemas
│   │   ├── services/        ai, scan, supabase, extract
│   │   ├── config/, types/, utils/
│   │   ├── app.ts, server.ts
│   ├── api/index.ts         Vercel serverless entry
│   ├── tests/               node:test unit and API tests
│   └── Dockerfile, railway.toml, vercel.json
├── mobile/                  Expo / React Native Android app
│   ├── app/                 Expo Router screens (auth, tabs, onboarding, admin, setup)
│   ├── components/ui/, hooks/, lib/, constants/, docs/
│   └── app.json, eas.json, babel.config.js
├── extension/               Chrome MV3 extension (TypeScript)
│   ├── src/                 api, auth, config
│   ├── background/, content/, popup/, options/
│   ├── manifest.json, build.mjs
├── supabase/                migrations and edge functions
├── docs/                    architecture, engine, and audit documentation
│   └── nsie/                the detection engine design set
├── outputs/                 generated PDFs (build artifacts)
├── assets/                  shared static assets
├── .github/workflows/       CI
└── README.md, DECISIONS.md
```

A few things stand out. There is no root `package.json` and no workspace tooling, so each app installs and builds on its own. Shared concepts such as scan types, risk levels, the Supabase config, and the API client are copied into each app rather than shared. And `outputs/` holds two generated PDFs that are tracked in git, which is the kind of thing that usually belongs in `.gitignore`.

## Target monorepo

This is the structure the migration produces. It follows the shape requested for the project and maps cleanly onto what already exists.

```
neural-shield-ai/
├── apps/
│   ├── web/                 was frontend/
│   ├── android/             was mobile/
│   └── extension/           was extension/
├── backend/
│   ├── api/                 HTTP layer: routes, controllers, middleware
│   ├── auth/                token verification, plan gates, admin checks
│   ├── ai/                  OpenRouter client and explanation service
│   ├── ml/                  model serving hooks (NSIE v3 and later)
│   ├── threat-engine/       was backend/src/engine (rules, collectors, risk, reputation)
│   └── services/            scan persistence, reporting, reputation writes
├── packages/
│   ├── ui/                  shared components and design tokens
│   ├── utils/               shared helpers
│   ├── types/               scan, risk, profile, and signal types
│   ├── validation/          shared Zod schemas
│   ├── config/              Supabase URL and keys, API base URLs, risk labels and colors
│   └── sdk/                 the one API client every app imports
├── database/                was supabase/ (migrations, functions, seed)
├── docs/
├── infrastructure/          Docker, Vercel, Railway, and CI config in one place
└── scripts/                 build, release, and maintenance scripts
```

## How today maps to the target

| Today | Target | Notes |
|-------|--------|-------|
| `frontend/` | `apps/web/` | Vercel root directory must be repointed |
| `mobile/` | `apps/android/` | EAS build config and app root must be repointed |
| `extension/` | `apps/extension/` | build script output paths change |
| `backend/src/engine/` | `backend/threat-engine/` | the detection engine, moved and renamed |
| `backend/src/{routes,controllers,middleware}` | `backend/api/` | the HTTP layer |
| `backend/src/services/ai.service.ts` | `backend/ai/` | LLM explanation only |
| `backend/src/services/{scan,supabase,extract}` | `backend/services/` | persistence and helpers |
| `backend/src/middleware/auth.middleware.ts` | `backend/auth/` | token and role checks |
| duplicated types in each app | `packages/types/` | one source of truth |
| duplicated Supabase config | `packages/config/` | env driven, no hardcoding |
| three API clients | `packages/sdk/` | one client, three consumers |
| `supabase/` | `database/` | migrations and functions |
| Docker, Vercel, Railway, CI | `infrastructure/` | grouped, not scattered |
| `outputs/` | removed from git | generated, belongs in `.gitignore` |

## Naming

Once the apps and packages share a workspace, they should share a naming scheme. The suggestion is a scope, for example `@neural-shield/web`, `@neural-shield/android`, `@neural-shield/backend`, and `@neural-shield/types`. Today the names are inconsistent (`frontend`, `neural-shield-backend`, `neural-shield-ai`, `neural-shield-extension`), and the mobile app in particular shares the bare product name, which is confusing once everything sits side by side.

## Why the move is staged, not instant

Three of these apps deploy from a fixed folder. The web app and backend are Vercel projects whose root directory points at `frontend/` and `backend/`. The Android app builds from `mobile/` through EAS. The extension builds from `extension/`. Moving those folders without updating the deploy settings breaks the builds. The order of operations and the exact settings to change are in `docs/migration-guide.md`.
