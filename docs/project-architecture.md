# Project Architecture

This document describes how Neural Shield AI is actually built today, across every app and service in the repository. It is written from a read of the current `main` branch and the working tree, not from an idealized design.

## The short version

Neural Shield AI is one product with three front doors and one brain.

The three front doors are a web app, an Android app, and a Chrome extension. The brain is a TypeScript backend that runs the detection engine and talks to Supabase for data and auth, and to OpenRouter for the language model that writes explanations. Everything a user does eventually turns into a scan, and every scan runs through the same engine so the verdicts are consistent no matter which client asked.

```
        Web (Next.js)     Android (Expo)     Chrome Extension (MV3)
              \                 |                     /
               \                |                    /
                \               v                   /
                 +-----------------------------------+
                 |   Backend API (Express + TS)      |
                 |   scan / admin / extension /      |
                 |   report / reputation / health    |
                 +-----------------------------------+
                    |            |               |
                    v            v               v
              Detection      Supabase        OpenRouter
              Engine         (Postgres,      (LLM, used
              (rules,        Auth, RLS,      only to
              collectors,    Storage,        explain a
              risk,          Edge fns)       verdict)
              reputation)
```

## The clients

### Web app (`frontend/`)
Next.js App Router on React 19 and Tailwind v4. It carries the marketing landing page, the auth flow backed by Supabase, the user dashboard and scan history, a profile and settings area, an admin area under `frontend/src/app/admin`, some server routes under `frontend/src/app/api`, and a privacy page. Route protection lives in `frontend/src/proxy.ts` (Next 16 renamed the old middleware file to `proxy`). It reads scan and profile data straight from Supabase under row level security, and it posts scans to the backend with the user's Supabase access token.

### Android app (`mobile/`)
An Expo and React Native app using Expo Router. It stores the session in the device secure store (`expo-secure-store`), reads history and profile directly from Supabase, and posts scans to the backend at `mobile/lib/api.ts`. It has camera and image picker support for the screenshot and QR scanners, an onboarding flow, permission and phone setup screens, an admin screen, and the standard tabs (home, scan, history, profile). The backend base URL is currently hardcoded in `mobile/lib/api.ts`.

### Chrome extension (`extension/`)
A Manifest V3 extension written in TypeScript, with a background service worker, a content script that runs on every page, a popup, and an options page. It signs in against Supabase directly with the password grant and keeps the tokens in `chrome.storage.local` (`extension/src/auth.ts`). It calls two backend endpoints that are specific to the extension: `POST /api/extension/analyze` for batch entity analysis and `GET /api/extension/config` for engine thresholds and version. It has its own small build step (`extension/build.mjs`).

## The backend (`backend/`)

A TypeScript Express service that runs both as a normal server and as a Vercel serverless function (`backend/api/index.ts`, with `backend/vercel.json` handling the rewrites). The route groups are:

- `scan` for the seven scan types (message, url, email, phone, upi, screenshot, qr)
- `extension` for the extension's batch analyze and config endpoints
- `admin` for founder and operator dashboards (stats, users, scans), gated by an admin check
- `report` for user feedback on a verdict
- `reputation` for the community reputation signals
- `health` for uptime checks

The heart of the backend is `backend/src/engine/`. This is the detection engine, and it is intentionally not a single model. It is a pipeline:

1. Normalize and classify the input into a typed entity (url, domain, email, phone, upi, or text).
2. Run a deterministic rule engine, which is synchronous, fast, and needs no network.
3. For url, domain, and email inputs, run a set of threat intelligence collectors in parallel (`backend/src/engine/collectors` and `backend/src/engine/intel`), covering things like RDAP, TLS, Google Safe Browsing, URLHaus, PhishTank, and others.
4. Pull community reputation signals from Supabase.
5. Feed every signal into the risk engine (`backend/src/engine/risk.ts`), which is the only place that produces numbers.
6. Ask the language model, through OpenRouter, to turn the finished verdict into a plain explanation. The model never changes the score.

The design rule is worth repeating because it drives the whole system: the numbers come from auditable logic, and the model only communicates them. The full write-up lives in `docs/nsie/nsie-overview.md` and the surrounding `docs/nsie/` set, plus `docs/trust-engine-architecture.md`.

## Data and auth (Supabase)

Supabase is the system of record. It holds:

- Postgres with row level security on every table, so a client can only ever read or write its own rows
- Auth (email and OAuth), which issues the JWTs that every client sends to the backend
- Storage, used for avatars
- Edge functions for the two jobs that need elevated privileges: account deletion and Razorpay checkout

The backend does not hold a service role key. It runs under each user's JWT, so the database enforces tenancy even if application code has a bug. The schema and its history live in `supabase/migrations`, and the edge functions live in `supabase/functions`.

## How a scan flows end to end

1. A client collects the input and attaches the user's Supabase access token.
2. The backend authenticates the token, checks the plan and rate limits, and validates the payload.
3. The engine runs the pipeline above and produces a verdict with a probability, a trust score, a risk band, a confidence value, and the list of signals that got it there.
4. The verdict is written to the `scans` table under the user's identity, and any flags or signals are stored alongside it.
5. The client shows the verdict and can read it back later from history.

## What talks to what

| Client | Reads data from | Sends scans to | Auth source |
|--------|-----------------|----------------|-------------|
| Web | Supabase (RLS) | Backend `/api/scan/*` | Supabase session cookie |
| Android | Supabase (RLS) | Backend `/api/scan/*` | Supabase secure store session |
| Extension | Backend responses | Backend `/api/extension/analyze` | Supabase tokens in `chrome.storage.local` |

## Where this architecture is heading

The requested next step is to pull the shared pieces (types, the Supabase config, the API client, risk labels and colors, and validation) out of each app and into shared packages, then arrange the whole thing as a single monorepo. The design is sound and the mapping is clean. The care is all in the execution, because three of these apps are deployed to places whose build settings are pinned to the current folder layout. That migration is planned in `docs/migration-guide.md`.
