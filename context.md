# Neural Shield AI — `context.md`

> Single source of architectural truth for Neural Shield AI. This document was reverse
> engineered from the repository (read only, no code changed). It is intended to be read
> before any future architectural, security, or product change. Where the repository does
> not settle a question, the text says so explicitly rather than guessing.
>
> Generated: 2026-07-04. Repo HEAD at generation: `9758e8b` (main).
>
> **Update 2026-07-04 (branch `security/production-hardening`):** production-hardening pass applied.
> Changes reflected below: scan-quota consumption moved to a `SECURITY DEFINER` RPC
> (`app_consume_scan_quota`, migration 0013) with counter columns revoked from clients; CORS fails
> closed in production; the dormant Razorpay `PRICES` map corrected to the current catalog; and the
> "Upgrade to Pro" wording changed to "Upgrade Plan" across the app. A full security report set
> lives in `docs/*security*` and `docs/owasp-report.md`; founder runbooks in `docs/founders/*`.

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Repository overview](#2-repository-overview)
3. [Technology stack](#3-technology-stack)
4. [Architecture](#4-architecture)
5. [Frontend](#5-frontend)
6. [Backend](#6-backend)
7. [Database](#7-database)
8. [Authentication](#8-authentication)
9. [Authorization](#9-authorization)
10. [API documentation](#10-api-documentation)
11. [AI engine](#11-ai-engine)
12. [ML engine](#12-ml-engine)
13. [Chrome extension](#13-chrome-extension)
14. [Android / mobile app](#14-android--mobile-app)
15. [Self-hosted n8n](#15-self-hosted-n8n)
16. [Deployment](#16-deployment)
17. [Third-party services](#17-third-party-services)
18. [Payments](#18-payments)
19. [Security review](#19-security-review)
20. [Dependency analysis](#20-dependency-analysis)
21. [Environment variables](#21-environment-variables)
22. [Repository health](#22-repository-health)
23. [Technical debt](#23-technical-debt)
24. [Known bugs](#24-known-bugs)
25. [Recommendations](#25-recommendations)
26. [Future architecture](#26-future-architecture)
27. [Documentation coverage](#27-documentation-coverage)
28. [Repository metrics](#28-repository-metrics)
29. [Founder notes](#29-founder-notes)
30. [Glossary](#30-glossary)

---

## 1. Executive summary

Neural Shield AI is an **AI-powered scam and fraud detection product built for the Indian
market**. A user pastes a suspicious artifact — a message, a URL, an email, a phone number, a
UPI ID, a screenshot, or a QR code — and the system returns, in seconds, a structured verdict:
a **scam probability (0–1)**, a **trust score (0–100)**, a **risk level** (`safe` → `critical`),
a **confidence** figure, the exact **red-flag signals** it found, a plain-language
**recommendation**, and an **advisory scam-type label** (phishing, fake KYC, UPI fraud, lottery,
job/loan fraud, and so on).

The product is delivered across **four surfaces that share one backend**:

- a **Next.js 16 web app** (landing, auth, dashboard, 7 scanners, history, profile, admin console);
- an **Express + TypeScript API** that runs the detection engine and persists results;
- a **Chrome MV3 extension** that passively flags suspicious links and can batch-analyze entities;
- an **Expo / React Native (Android-first) mobile app**.

Data, auth, storage, and privileged server logic live in **Supabase** (Postgres with Row-Level
Security, Supabase Auth, Storage, and Deno edge functions).

The single most important architectural fact is the **Trust Engine v2** (a.k.a. NSIE — Neural
Shield Intelligence Engine). Unlike a naive "ask the LLM to score it" design, **every number is
produced deterministically by a rule + threat-intelligence + reputation engine**, and the LLM is
demoted to an *explainer* that narrates the evidence and may never emit a score. This makes
verdicts auditable, reproducible (versioned scoring matrix), and resistant to prompt injection.

A second defining fact: **the Express backend holds no Supabase service-role key**. It operates
under **each user's JWT**, so every database access is enforced by RLS at the database. Privileged
operations (API-key verification, admin reads, payment approval, account deletion) go through
`SECURITY DEFINER` RPCs or edge functions, never through an ambient super-user credential.

Monetization is a **Free tier plus four paid plans** (Individual, Two-person, Family, Pro), priced
in rupees, with quotas enforced per user. Payment is currently a **semi-manual UPI + admin-approval
flow** (personal UPI VPA, screenshot upload, admin approves in an admin console). A Razorpay
integration exists in the codebase but is **dormant / superseded**.

The build has moved through six numbered phases (design system, auth, scanner engine, dashboard,
profile/settings, CI/CD) plus a multi-week Trust Engine v2 program and a plans/billing overhaul.
Web and backend are live on Vercel; the database is a single live Supabase project.

---

## 2. Repository overview

This is an **npm workspaces monorepo**. The workspace root (`package.json`) declares
`frontend`, `backend`, and `packages/*` as workspaces. **`mobile/` and `extension/` are
deliberately excluded** from the workspace (Expo pins its own React/React Native and would break
under hoisting; the extension builds standalone with esbuild).

```
/
├── frontend/              # Next.js 16 web app (landing, auth, dashboard, scanners, admin)
├── backend/               # Express + TypeScript scan API + Trust Engine v2 + tests
├── mobile/                # Expo / React Native (Android-first) app
├── extension/             # Chrome MV3 extension (popup, options, background, content)
├── packages/              # Shared workspace packages
│   ├── types/             # Declaration-only scan contract (@neural-shield/types)
│   ├── config/            # Plans catalog, risk vocabulary, scanner catalog (@neural-shield/config)
│   ├── validation/        # Shared Zod-ish validation (@neural-shield/validation)
│   └── sdk/               # Runtime-agnostic scan API client (@neural-shield/sdk)
├── supabase/              # SQL migrations (0001..0012) + edge functions + setup guide
├── infrastructure/n8n/    # Self-hosted n8n docker-compose + env template (setup files only)
├── docs/                  # ~50 markdown docs incl. docs/nsie/* (the ML/engine design)
├── outputs/               # Generated PDFs (project summaries)
├── .github/workflows/     # CI (type-check, lint, test, build for frontend + backend)
├── docker-compose.dev.yml # Local full-stack dev
├── gen_icons.py           # Helper: generate extension PNG icons (pure Node/py)
├── test-scan.mjs          # Standalone scan smoke-test script
├── DECISIONS.md           # Architecture decision log (D1..D9)
└── README.md
```

### Key files by area

| File | Purpose |
|---|---|
| `DECISIONS.md` | Why the build deviates from spec (stack versions, Supabase Auth, engine, billing). |
| `backend/src/app.ts` | Express app factory: Helmet, CORS allow-list, rate limit, route mounting. |
| `backend/src/threat-engine/index.ts` | Trust Engine v2 orchestrator (the heart of the product). |
| `backend/src/threat-engine/risk.ts` | The **only** place numbers are produced. |
| `backend/src/threat-engine/config/weights.ts` | Versioned scoring matrix (weights as data). |
| `backend/src/services/ai.service.ts` | OpenRouter client; legacy scorer + v2 explainer + templated fallback. |
| `backend/src/middleware/auth.middleware.ts` | JWT + API-key auth, dev bypass, plan/admin guards. |
| `frontend/src/proxy.ts` | Next 16 route guard (formerly `middleware.ts`). |
| `frontend/src/store/useAppStore.ts` | Zustand auth/session/profile store. |
| `packages/config/index.ts` | The plans catalog — single source of truth for pricing/quotas. |
| `supabase/migrations/*` | The full evolving schema + RLS + SECURITY DEFINER RPCs. |

---

## 3. Technology stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js **16.2.9** (App Router, React Compiler enabled), React **19.2.4**, TypeScript, Tailwind CSS **v4** (no `tailwind.config.ts`; tokens in `globals.css` via `@theme`), Framer Motion, Zustand, TanStack React Query, Recharts, Radix UI primitives, lucide-react, axios, `@supabase/ssr` + `@supabase/supabase-js`, Sentry (`@sentry/nextjs`). |
| **Backend** | Node 20, Express **4.21**, TypeScript (CommonJS output), Helmet, `express-rate-limit`, Zod, Winston, multer, Tesseract.js (OCR), jimp + jsQR (QR decode), `@supabase/supabase-js`, `@sentry/node`. |
| **Mobile** | Expo **~54**, React Native **0.81.5**, React **19.1.0**, expo-router, React Query, Zustand, axios, expo-camera / image-picker / secure-store / clipboard / haptics, react-native-reanimated, lucide-react-native, `@supabase/supabase-js`. |
| **Extension** | Chrome Manifest V3, TypeScript, esbuild (`build.mjs`), Supabase auth via REST. |
| **Shared packages** | `@neural-shield/types` (declaration-only), `@neural-shield/config`, `@neural-shield/validation`, `@neural-shield/sdk`. |
| **Data / Auth** | Supabase — Postgres + Row-Level Security, Supabase Auth (email + Google/GitHub OAuth), Storage buckets, Deno **edge functions**. |
| **AI** | OpenRouter (multi-model fallback: `anthropic/claude-3.5-haiku` → `openai/gpt-4o` → `openai/gpt-4o-mini`). |
| **Threat intel** | Google Safe Browsing, URLHaus, PhishTank, OpenPhish, Spamhaus (DBL/ZEN), AbuseIPDB, VirusTotal, RDAP, DNS, TLS. |
| **Payments** | UPI + admin approval (active); Razorpay edge function (dormant). |
| **Automation** | Self-hosted n8n (docker-compose, setup files only — user runs it). |
| **CI/CD** | GitHub Actions (`.github/workflows/ci.yml`); Vercel deploy for frontend + backend. |
| **Hosting** | Vercel (web + backend serverless function); Supabase cloud (DB/auth/storage/functions). Backend `Dockerfile` + `railway.toml` provided for a container host (recommended for OCR). |
| **Observability** | Sentry (frontend + backend), Winston logs (file transports skipped on Vercel). |

---

## 4. Architecture

### 4.1 System context

```mermaid
flowchart TB
  subgraph Clients
    WEB[Next.js 16 web app]
    MOB[Expo / React Native app]
    EXT[Chrome MV3 extension]
  end

  subgraph Supabase
    AUTH[(Supabase Auth)]
    DB[(Postgres + RLS)]
    STG[(Storage: avatars, payment-proofs)]
    EF[Edge Functions: delete-account, razorpay-checkout]
  end

  API[Express API + Trust Engine v2]
  OR[OpenRouter LLMs]
  TI[Threat Intel: GSB / URLHaus / PhishTank / OpenPhish / Spamhaus / AbuseIPDB / VirusTotal / RDAP / DNS / TLS]
  N8N[Self-hosted n8n]

  WEB -->|Supabase JS: auth + RLS reads| AUTH
  WEB -->|RLS reads| DB
  WEB -->|avatar upload| STG
  WEB -->|Bearer JWT| API
  WEB -->|invoke| EF
  MOB -->|Bearer JWT| API
  MOB -->|RLS reads| DB
  EXT -->|Bearer JWT / config| API

  API -->|verify JWT / RLS / RPC| DB
  API -->|explanation only| OR
  API -->|evidence collection| TI
  EF --> DB
  N8N -->|reads subscribers| DB
```

### 4.2 Request → verdict data flow (the core loop)

```mermaid
sequenceDiagram
  participant U as Client
  participant A as Express API
  participant M as auth.middleware
  participant E as Trust Engine v2
  participant TI as Threat Intel + Reputation
  participant L as OpenRouter (explainer)
  participant DB as Supabase (RLS / RPC)

  U->>A: POST /api/scan/{type} (Bearer JWT or X-API-Key)
  A->>M: authenticate + rate limit + Zod validate
  M-->>A: req.user {id, email, plan, isAdmin}, req.userToken
  A->>A: checkAndConsumeLimits (per-user daily+monthly cap)
  A->>E: runEngine(scanType, content)
  E->>E: normalize + extract sub-entities (URLs/UPIs/phones)
  E->>E: rule engine (content/identity/pay/phone signals)
  E->>TI: collectors in parallel (timeboxed budget, fail-open)
  TI-->>E: Signal[] (blocklist/domain-age/infra/reputation)
  E->>E: computeRisk() -> R, P, T, C, band  (DETERMINISTIC)
  E->>L: explain(verdict + evidence)  (NO numbers)
  L-->>E: {summary, recommendation, scamType} (or templated fallback)
  E-->>A: ScanResultV2 (+ signal trail)
  A->>DB: saveScan + scan_flags + scan_signals (as user, RLS)
  A-->>U: { success, data: SavedScan }
```

Two engine modes exist, gated by the `ENGINE_V2` env flag:

- **`ENGINE_V2=true` (default, current):** the deterministic engine decides the score; the LLM only
  explains. This is the `runEngine()` path.
- **`ENGINE_V2=false` (legacy):** `aiService.analyze()` asks the LLM to return the full result
  including the score. Kept unchanged for flag-off parity.

### 4.3 Layering (backend)

`routes → middleware (auth / rate-limit / validate / upload) → controllers → services / threat-engine
→ Supabase (RLS or SECURITY DEFINER RPC)`. Controllers are thin; the engine and services hold logic.
A standard JSON envelope (`{ success, message, data, timestamp }` / `{ success, message, details }`)
is emitted by `utils/response.ts`.

---

## 5. Frontend

**Framework:** Next.js 16 App Router with the React Compiler. Note `frontend/AGENTS.md`:
*"This is NOT the Next.js you know"* — Next 16 renamed `middleware.ts` to **`proxy.ts`** (exported
function `proxy`), among other breaking changes. Read `node_modules/next/dist/docs/` before editing.

### 5.1 Routing (App Router route groups)

| Group / path | Contents |
|---|---|
| `app/page.tsx` | Landing page (hero, neural orb, risk demo, subscribe, pricing, FAQ). |
| `app/(auth)/` | `login`, `signup`, `forgot-password` + `layout` (shared auth chrome). |
| `app/(dashboard)/` | `dashboard`, `history`, `profile`, `analyzer` + 7 scanner sub-pages (`url`, `message`, `email`, `phone`, `upi`, `screenshot`, `qr`) + `layout` (DashboardShell). |
| `app/admin/` | `dashboard`, `users`, `users/[id]`, `scans`, `feedback`, `logs`, `payments` + `layout` (AdminShell). |
| `app/auth/callback/route.ts` | OAuth / email-confirmation code exchange. |
| `app/api/og/route.tsx` | Dynamic Open Graph image. |
| `app/privacy`, `app/terms` | Legal pages. |
| `app/globals.css` | Tailwind v4 `@theme` design tokens (OKLCH), keyframes, glassmorphism. |
| `src/proxy.ts` | Route guard: refreshes Supabase cookie, redirects protected/auth routes. |

Protected prefixes: `/dashboard`, `/analyzer`, `/history`, `/profile`. Auth routes `/login`,
`/signup` bounce authenticated users to `/dashboard`. If Supabase env is absent, the proxy is a
no-op (app still runs with "not configured" messaging).

### 5.2 Components

- **`components/ui/`** (17 primitives): Alert, Badge, Button, Card, Checkbox, CookieBanner, Input,
  Label, Modal, Progress, Skeleton, Spinner, Switch, Textarea, Tooltip.
- **`components/scanner/`**: `ScannerShell` (content-only; chrome comes from the dashboard layout),
  `ResultCard`, `ResultPanel`, `ImageScanner`, `ProScannerNotice`.
- **`components/profile/`**: PersonalInfo (avatar upload + name), Notifications, ApiKeys,
  Security (change password + sign-out everywhere), DangerZone (delete account), PlanUpgrade (UPI),
  LinkedMembers (multi-user plan linking).
- **`components/landing/`**: Navbar, NeuralOrb, HeroScanPreview, RiskDemo, Subscribe.
- **`components/layout/`**: DashboardShell (sidebar + mobile drawer), AdminShell, Logo.
- **`components/dashboard/widgets.tsx`**: StatCard, RiskDonut, TypeBreakdown (Recharts).
- **`components/auth/`**: OAuthButtons, PasswordStrength.
- **`components/providers/AppProviders.tsx`**: React Query provider + store bootstrap.

### 5.3 State, data, networking

- **Auth/session/profile:** Zustand store `store/useAppStore.ts` — bootstraps the Supabase session
  once, subscribes to `onAuthStateChange`, loads the `profiles` row, exposes `signIn/signUp/
  signInWithOAuth/signOut/refreshProfile`.
- **Server state:** TanStack React Query (`hooks/useScans`, `useScanner`, `useAuth`).
- **Networking:** axios instance `lib/api.ts` attaches the Supabase access token to every request
  and **refreshes once on a 401**. Scanner calls go through `services/scanner.ts` (JSON via axios;
  multipart via `fetch` so the browser sets the boundary). Image uploads use the field name `file`.
- **Supabase clients:** `lib/supabase/{client,server,config}.ts` (browser client, SSR server client,
  env guards). Reads (dashboard, history, profile) happen **directly against Postgres under RLS**;
  scans go **through the Express API**.
- **Feature libs:** `lib/{scans,profile,payments,members,subscribe,billing,admin-api,demo-analyze}.ts`.
  `lib/billing.ts` is **dead code** (the old Razorpay path). `lib/demo-analyze.ts` is the
  frontend-only heuristic used by the landing "risk demo" (no API call).

### 5.4 Theme

Tailwind v4 with tokens in `globals.css` (`@theme`): cyan-mint primary `#00F5D4`, sky `#0EA5E9`,
violet `#7C3AED`, near-black navy `#050816` background, glassmorphism, glow shadows. Ported 1:1 from
the Lovable design reference (see `DECISIONS.md` D1/D3).

---

## 6. Backend

**Framework:** Express 4.21 on TypeScript, compiled to CommonJS. Entry points:
`src/server.ts` (long-running process, `app.listen`) and `api/index.ts` (Vercel serverless handler
that exports the Express app; `vercel.json` rewrites all traffic to it).

### 6.1 App wiring (`src/app.ts`)

1. `trust proxy = 1` (correct client IP behind Vercel/Render).
2. **Helmet** with a tight CSP (`default-src 'self'`, `connect-src 'self' openrouter.ai`,
   `img-src 'self' data:`) and cross-origin resource policy.
3. **CORS** with an allow-list from `APP_URL` + `FRONTEND_URL` (comma-separated, trailing slash
   normalized); browser extensions (`chrome-extension://`, `moz-extension://`) always allowed;
   no-Origin requests (curl/health) allowed; empty allow-list reflects any origin in dev but
   **fails closed in production** (migration on branch `security/production-hardening`).
4. `express.json({ limit: '1mb' })` + urlencoded.
5. Global rate limiter on `/api`.
6. Route mounts, then `notFound` + `errorHandler`.

### 6.2 Routes → controllers

| Router (`src/routes`) | Controller | Notes |
|---|---|---|
| `health.routes` | inline | Public health/status. |
| `scan.routes` | `scan.controller` | 5 text scanners (auth + rate limit + Zod); 2 image scanners (Pro-gated multipart). |
| `report.routes` | `report.controller` | Community scam report (auth; JWT only, not API key). |
| `reputation.routes` | `reputation.controller` | Public reputation lookup (rate-limited). |
| `extension.routes` | `extension.controller` | Public `/config`; authed `/analyze` batch. |
| `admin.routes` | `admin.controller` | All routes `authenticate + requireAdmin()`. |

### 6.3 Middleware (`src/middleware`)

- **`auth.middleware`** — API-key path (SHA-256 hash → `app_verify_api_key` RPC, Pro-gated) or
  Supabase JWT path (`verifyToken`). Dev bypass (`DEV_USER`, admin, free) when Supabase is absent
  **and** `NODE_ENV != production`; hard-disabled in prod. Exposes `requirePlan([...])` and
  `requireAdmin()`.
- **`rateLimit.middleware`** — global (100 req / 15 min per IP) and scan (30 / 15 min per user-or-IP).
  Extension (`60/min`) and reputation (`120/min`) limiters are defined inline in their routers.
- **`validate.middleware`** — `validateBody(schema)` runs Zod; returns 400 with flattened errors.
- **`upload.middleware`** — multer memory storage, `file` field, 10 MB, PNG/JPG/WebP only.
- **`error.middleware`** — `notFound` (404) + central `errorHandler`.

### 6.4 Services (`src/services`)

- **`ai.service`** — OpenRouter fallback chain with per-model `AbortController` timeout and failover;
  three entry points: `analyze()` (legacy full scorer), `explain()` (v2, narrative only, never throws
  — falls back to `templatedExplanation`), plus JSON extraction/normalization helpers and
  `inferScamType()`.
- **`scan.service`** — `checkAndConsumeLimits` (per-user daily + monthly caps with window reset),
  `saveScan` (inserts scan + `scan_flags` + `scan_signals` as the user under RLS), `audit`.
- **`extract.service`** — OCR (`ocrImage`, Tesseract.js) and QR decode (`decodeQr`, jimp + jsQR).
- **`supabase.service`** — anon client (JWT validation + public RPCs), `getUserClient(token)`
  (request-scoped RLS client), `verifyToken` (resolves effective plan via `app_effective_plan` RPC +
  admin flag), `verifyApiKey`, `recordApiScan`.

### 6.5 Logging & error handling

Winston (`utils/logger.ts`); file transports are skipped when `process.env.VERCEL` is set. Sentry is
initialized in `src/instrument.ts`, imported first in `server.ts`. Scan failures return a clean
`502 "Analysis failed"`; limit breaches return `429` with a `DAILY_LIMIT_EXCEEDED` code.

---

## 7. Database

**Type:** PostgreSQL via Supabase. Schema evolves through **immutable migrations**
`supabase/migrations/0001..0012` (with parallel `0008/0009/0010/0011` files because migrations are
append-only — a "week N" slice and a "phase N" slice share a number). RLS is enabled on every
user-facing table.

> ⚠️ Migrations mirror the *applied* live migrations. The live project is a single Supabase project
> `jdcilinhabwilvbrjwjp` (`ap-southeast-1`). Some columns the mobile app reads (`scans.signals`,
> `scans.flags`, `scans.explanation`, `profiles.phone`) are **not present in the tracked migrations**
> — this is likely live drift added directly. Treat those as "unable to fully confirm from repository."

### 7.1 Core tables

| Table | Purpose | Key columns | RLS |
|---|---|---|---|
| `profiles` | 1:1 with `auth.users`; app data. | `id`, `email`, `name`, `plan` (`free`/`individual`/`two_person`/`family`/`pro`), `is_admin`, `daily_scan_count/reset_at`, `monthly_scan_count/reset_at`, `avatar_url`, `notification_prefs` (jsonb). | Own row select/update; **`plan` and scan-counter columns revoked from users** (only name/avatar/notification_prefs granted; counters mutated only via `app_consume_scan_quota`, migration 0013). |
| `scans` | One scan + verdict. | inputs, `scam_probability`, `trust_score`, `risk_level`, `scam_type`, `ai_model`, `risk_score`, `confidence`, `engine_version`, `primary_entity_*`. | Owner full CRUD. |
| `scan_flags` | Human-readable flags per scan. | `scan_id`, `flag`, `severity`. | Via parent scan owner. |
| `scan_signals` | **Evidence trail** (one row per signal). | `signal_id`, `category`, `weight`, `confidence`, `source_tier`, `source`, `override`, `evidence` (jsonb). | Via parent scan owner. |
| `subscriptions` | Legacy Razorpay subscription row. | `plan`, `status`, `razorpay_subscription_id`, `expires_at`. | Owner. |
| `feedback` | User feedback on a scan. | `scan_id`, `is_accurate`, `comment`. | Owner. |
| `audit_logs` | User-scoped audit trail (backend writes as user). | `action`, `resource`, `ip_address`, `metadata`. | Own select + **own insert** (required for backend audit writes). |
| `api_keys` | Business/Pro API keys. | `key_prefix`, `last_four`, **`key_hash` (SHA-256 only)**, `revoked_at`, `last_used_at`. | Owner. |
| `admin_logs` | Admin action audit. | `admin_id`, `action`, `resource`, `target_id`. | Admin select; self insert. |

### 7.2 Plans & payments

| Table | Purpose |
|---|---|
| `plan_memberships` | Multi-user plans (Two-person/Family). Owner links members by email; `slot`, `member_email`, `member_id`, `email_locked_until` (30-day change lock). |
| `payment_requests` | UPI upgrade requests: `plan`, `amount_inr`, `reference_note`, `upi_reference`, `screenshot_path`, `status` (pending/approved/rejected), reviewer fields. |
| `subscribers` | Newsletter emails captured on the landing page (`app_subscribe` RPC; admin-read only). |

### 7.3 Reputation / threat-intel schema (Trust Engine v2)

| Table | Purpose |
|---|---|
| `threat_sources` | Canonical registry of intel sources (seeded: gsb, urlhaus, phishtank, openphish, rdap, tls, dns, structural, rule_engine, reputation_db). Public read. |
| `domains`, `urls`, `emails`, `phone_numbers`, `upi_ids` | Shared reputation state per entity (report counts, reputation score). Public read; writes via RPC only. |
| `reports` | User-submitted scam reports (`entity_type`, `entity_value`, `report_type`, `notes`). Owner-only RLS. |
| `entity_intel` | Per-source, verdict-aware **TTL cache** for external TI lookups (`source`, entity, `verdict`, `raw`, `signals`, `expires_at`). Public read; write via `app_upsert_entity_intel`. |

### 7.4 ER overview

```mermaid
erDiagram
  auth_users ||--|| profiles : "1:1 (trigger)"
  profiles ||--o{ scans : owns
  scans ||--o{ scan_flags : has
  scans ||--o{ scan_signals : has
  profiles ||--o{ api_keys : owns
  profiles ||--o{ feedback : writes
  profiles ||--o{ audit_logs : generates
  profiles ||--o{ payment_requests : submits
  profiles ||--o{ plan_memberships : "owns / member_of"
  profiles ||--o{ reports : submits
  domains ||--o{ urls : contains
```

### 7.5 Triggers, functions, storage

- **`handle_new_user`** (SECURITY DEFINER trigger on `auth.users`) auto-creates the `profiles` row.
- **`resolve_pending_members`** (trigger on `profiles`) back-fills `plan_memberships.member_id` when a
  previously-linked email signs up.
- **`set_updated_at`** trigger on `profiles`.
- **SECURITY DEFINER RPCs** (locked `search_path`): `app_consume_scan_quota` (atomic per-user scan
  metering — migration 0013; counter columns revoked from client UPDATE), `app_effective_plan`, `app_link_member`,
  `app_unlink_member`, `app_verify_api_key`, `app_record_api_scan`, `app_record_signals`,
  `app_submit_report`, `app_get_reputation`, `app_upsert_entity_intel`, `app_subscribe`,
  `admin_is_admin`, `admin_get_stats/users/user/scans/feedback/logs`, `admin_list_payments`,
  `admin_approve_payment`, `admin_reject_payment`.
- **Storage buckets:** `avatars` (own-folder RLS) and `payment-proofs` (private; own-folder insert,
  owner-or-admin read).

---

## 8. Authentication

**Model (DECISIONS D2):** native **Supabase Auth**, *not* custom JWT/bcrypt. Credentials live in
`auth.users`; RLS policies key on `auth.uid()`. A self-signed JWT would never populate `auth.uid()`,
so custom JWT was rejected.

- **Signup / login:** `useAppStore.signUp/signIn` call `supabase.auth.signUp` /
  `signInWithPassword`. Email confirmation supported (`needsEmailConfirmation` when no session).
- **OAuth:** Google + GitHub via `supabase.auth.signInWithOAuth`; `app/auth/callback/route.ts`
  exchanges the code.
- **Sessions / refresh:** Supabase manages the session; the web axios client refreshes once on 401;
  the extension worker proactively refreshes 5 minutes before expiry; mobile signs out and redirects
  on 401.
- **Backend JWT verification:** `verifyToken(token)` calls `supabase.auth.getUser(token)`, then
  resolves the **effective plan** via the `app_effective_plan` RPC (own plan or an inherited
  Two-person/Family plan) and the `is_admin` flag, all under the user's RLS client.
- **API-key auth:** header `X-API-Key: nsk_...` or an `nsk_`-prefixed Bearer. The raw key is SHA-256
  hashed and verified via `app_verify_api_key`. Requires the **Pro** plan (403 otherwise). API scans
  persist via `app_record_api_scan` (the backend has no service role, so key possession is the auth).
- **Dev bypass:** when Supabase is unconfigured and `NODE_ENV != production`, requests run as a fixed
  `DEV_USER` (admin, free). Disabled in production.
- **Edge functions:** `delete-account` (verify_jwt, service-role admin delete → FK cascade) and
  `razorpay-checkout` (verify signature, upgrade plan) hold the service role; the Express backend
  never does.

---

## 9. Authorization

Authorization is enforced in **three layers**: RLS at the database, `SECURITY DEFINER` RPCs for
cross-user/privileged reads, and middleware gates in Express.

### 9.1 Roles

| Role | How set | Capabilities |
|---|---|---|
| **Anonymous** | no session | Landing page, public reputation lookup, subscribe, extension `/config`. |
| **Authenticated user** | Supabase session | Own scans/history/profile/reports/feedback; submit UPI payment; link members (if on a multi-user plan). All scoped by RLS to `auth.uid()`. |
| **API-key holder (Pro)** | valid `nsk_` key | Programmatic scans only (no reports; report requires a JWT). |
| **Admin** | `profiles.is_admin = true` | Admin console reads (stats/users/scans/feedback/logs) + approve/reject UPI payments, via `requireAdmin()` + admin RPCs that re-check `is_admin` inside. |
| **Founder / owner** | Supabase project owner + admin flag | Everything an admin can do, plus out-of-band ops the app cannot do: rotate keys, set Vercel/Supabase env, run migrations, deploy edge functions, run n8n. |

### 9.2 Permission enforcement points

- **Plan gating:** `requirePlan(["pro"])` on `/scan/screenshot` and `/scan/qr`; API access requires
  Pro (checked in `authenticate`). Scanner catalog per plan lives in `packages/config` and
  `backend/src/config/plans.ts` (kept in sync manually).
- **Quotas:** `checkAndConsumeLimits` enforces per-user daily + monthly caps (Free 10/day; Individual
  30/day 150/mo; Two-person 22/day 110/mo; Family 15/day 75/mo; Pro unlimited).
- **Plan escalation prevention:** the `plan` column is **revoked** from `authenticated` UPDATE
  (migration 0006). Plans change only via admin approval RPC (`admin_approve_payment`) or the Razorpay
  edge function.
- **Admin RPCs** all `RAISE EXCEPTION '42501'` if `admin_is_admin()` is false — defense in depth even
  if the Express `requireAdmin()` gate were bypassed.

---

## 10. API documentation

Base URL: `${NEXT_PUBLIC_API_URL}` (prod backend `https://backend-one-gamma-9n6duzcmcq.vercel.app`,
Express mounts under `/api`). Standard envelopes: success
`{ success:true, message, data, timestamp }`; error `{ success:false, message, details, timestamp }`.

### 10.1 Endpoints

| Method | Path | Auth | Plan | Body / params | Notes |
|---|---|---|---|---|---|
| GET | `/api/health` | none | — | — | Service status + AI/Supabase configured flags. |
| POST | `/api/scan/message` | JWT or API key | any (key→Pro) | `{ text }` (10–5000) | Text scan. |
| POST | `/api/scan/url` | JWT or API key | any | `{ url }` (valid URL ≤2048) | URL scan. |
| POST | `/api/scan/email` | JWT or API key | any | `{ subject?, body, sender? }` | Email scan. |
| POST | `/api/scan/phone` | JWT or API key | any | `{ phone }` (Indian format) | Phone scan. |
| POST | `/api/scan/upi` | JWT or API key | any | `{ upiId }` (`name@psp`) | UPI scan. |
| POST | `/api/scan/screenshot` | JWT | **Pro** | multipart `file` (image) | OCR then analyze. |
| POST | `/api/scan/qr` | JWT | **Pro** | multipart `file` (image) | Decode QR then analyze. |
| POST | `/api/report` | JWT only | any | `{ entityType, entityValue, reportType, notes? }` | Community report (API key → 403). |
| GET | `/api/reputation/:type/:value` | none | — | path params | Aggregated, time-decayed reputation. |
| GET | `/api/extension/config` | none | — | — | Engine version, thresholds, supported types. |
| POST | `/api/extension/analyze` | JWT or API key | any | `{ entities: [{type,value}] }` (≤10) | Batch analyze, skips LLM explanation. |
| GET | `/api/admin/stats` | JWT | admin | — | Aggregate stats. |
| GET | `/api/admin/users` | JWT | admin | `limit,offset,search,plan,sort_*` | Paginated users. |
| GET | `/api/admin/users/:id` | JWT | admin | — | User detail. |
| GET | `/api/admin/scans` | JWT | admin | filters | Paginated scans (input truncated to 120 chars). |
| GET | `/api/admin/feedback` | JWT | admin | `limit,offset` | Feedback list. |
| GET | `/api/admin/logs` | JWT | admin | `limit,offset` | Admin action log. |
| GET | `/api/admin/payments` | JWT | admin | `?status=pending` | Payment requests. |
| POST | `/api/admin/payments/:id/approve` | JWT | admin | — | Approve → set plan + reset counters. |
| POST | `/api/admin/payments/:id/reject` | JWT | admin | `{ note? }` | Reject. |

### 10.2 Error codes

`400` validation/bad request · `401` missing/invalid token or API key · `403` plan/admin gate or
report-via-API-key · `422` OCR/QR could not extract · `429` quota (`DAILY_LIMIT_EXCEEDED`) or rate
limit · `500` internal/RPC failure · `502` analysis failed (all models failed) · `503` server auth /
reputation not configured.

### 10.3 Rate limits

Global 100 / 15 min per IP · scan 30 / 15 min per user-or-IP · extension 60 / min · reputation
120 / min. Per-user scan quotas are separate (see §9.2).

---

## 11. AI engine

### 11.1 Trust Score & Scam Probability logic (deterministic)

**All numbers are produced only in `threat-engine/risk.ts`** from the `Signal[]` trail. Pipeline:

1. **Hard overrides.** A tier-1 blocklist hit with `override:"malicious"` and confidence ≥ 0.9
   (GSB, PhishTank, URLHaus, OpenPhish, community-override) forces `riskScore = 100` and
   `confidence ≥ 0.95`. An `allowlist` override (verified org, trusted domain) caps risk at 10.
2. **Category-capped weighted accumulation.** Each signal's *effective weight* =
   `base weight × own confidence × source-tier multiplier` (tier 1 = 1.0, tier 2 = 0.7, tier 3 = 0.5).
   Positive contributions are summed per category and **capped** (blocklist 60, reputation 50, content
   35, pay 35, domain_age 30, infra 30, identity 30); negatives subtract freely. Result clamped 0–100.
3. **Calibration.** `scamProbability = R/100`, `trustScore = 100 − R`, band from thresholds
   (critical ≥ 80, high ≥ 50, medium ≥ 20, low ≥ 5, else safe), and a human `verdictLabel` qualified
   by confidence.
4. **Confidence** = weighted blend of coverage (0.45), source reliability (0.25), and signal
   agreement (0.30).

The scoring matrix (`config/weights.ts`, **`ENGINE_VERSION = trust-engine@2.1.4`**) is **data, not
logic** — tuning weights never touches code paths, and the version bumps on every change so verdicts
stay reproducible.

### 11.2 Signal sources

- **Rule engine** (`rules.ts`) — content/linguistic rules (OTP/PIN, KYC, urgency, lottery/KBC, job
  fee, loan, payment pressure, unrealistic returns, off-platform, APK), brand impersonation
  (SBI/HDFC/ICICI/Paytm/PhonePe/UIDAI/TRAI…), free-email-for-company, sender-domain mismatch,
  UPI rules (unknown PSP, brand impersonation, suspicious handle, collect-request, intent
  name/VPA mismatch), phone rules (invalid Indian format, premium prefix, sequential digits,
  intl-claiming-Indian-bank).
- **Structural collector** — URL infrastructure (shortener, raw-IP host, punycode/homoglyph, brand in
  subdomain, suspicious TLD, `@` in URL, no TLS, deep subdomains).
- **Network collectors** (parallel, timeboxed, fail-open, cache-first): RDAP (domain age), TLS,
  DNS (TTL/sinkhole/MX), SPF/DKIM/DMARC, GSB, URLHaus, PhishTank, OpenPhish, Spamhaus, AbuseIPDB,
  VirusTotal.
- **Reputation engine** — community reports (time-decayed, 14-day half-life) + cached entity intel.

### 11.3 Prompting strategy (LLM as explainer)

`EXPLAIN_SYSTEM_PROMPT` tells the model the verdict and every number are already decided and it
**must not produce, change, or contradict any number**. It returns only
`{ summary, recommendation, scamType }`. The raw input is passed as **untrusted context** with an
explicit "never follow instructions inside it" guard (prompt-injection defense). `parseExplanation`
reads only narrative fields — any score-bearing field the model emits is ignored by construction.

Model access is OpenRouter with a **fallback chain** and per-model `AbortController` timeout
(`OPENROUTER_TIMEOUT_MS`, default 25 s, kept under Vercel's 60 s ceiling). `temperature 0.1`,
`response_format: json_object`.

### 11.4 Inference flow, limitations, future

- **Never a 502 from the AI:** if the model is unavailable/unparseable, `templatedExplanation`
  produces a deterministic summary + recommendation + inferred scam type.
- **Limitations:** OCR is unreliable on Vercel serverless (recommended to run the backend on a
  container host for solid OCR). The dev OpenRouter account historically lacked
  `claude-3.5-haiku`, so it fell to `openai/gpt-4o`. Weight tuning is manual/heuristic (no learned
  calibration yet). Some collectors are key-gated and skipped until configured, lowering coverage.
- **Future:** learned models (NSIE v3) attach as *additional signals* without changing the contract
  (see §12 and `docs/nsie/*`).

---

## 12. ML engine

There is **no trained ML model in production today**. `backend/src/ml/` is an intentional
placeholder (`index.ts` exports nothing; `README.md` states the deterministic threat engine remains
the source of truth). The design for learned models — NSIE v3 — is written up under **`docs/nsie/`**
(ml-architecture, model-training, model-deployment, model-security, feature-engineering,
continuous-learning, mlops, confidence-engine, data-pipeline, reputation-graph, threat-fusion,
rule-engine, future-roadmap, nsie-overview).

- **Planned models/inference:** ONNX runtime hooks, feature adapters, and versioned model loading
  will live in `src/ml/`, kept separate from the deterministic engine. Model output is designed to be
  *one more signal*, never the final word.
- **Features/datasets/accuracy:** not implemented. Feature engineering and data pipeline are
  documented in `docs/nsie/*` but there is no dataset, training run, or accuracy figure in the repo.
- **Current "classification":** deterministic — scam-type is inferred from fired signal ids
  (`inferScamType`) or the LLM's advisory label.

> Verdict: the "ML engine" is a **documented roadmap**, not a shipped component. Do not describe the
> product as using trained ML today.

---

## 13. Chrome extension

**Manifest V3** (`extension/manifest.json`). Built with esbuild (`build.mjs`).

- **Permissions:** `activeTab`, `storage`, `tabs`; `host_permissions: <all_urls>`.
- **Background service worker** (`background/worker.ts`): token refresh via `chrome.alarms` (every
  10 min, refresh 5 min before expiry), message handlers (`PING`, `GET_AUTH`), and per-tab badge
  updates from content-script detections.
- **Content script** (`content/content.ts`): runs at `document_idle` on every page; passively scans
  anchor hrefs for high-risk TLDs (`.xyz/.top/.tk/.ml/.ga/.cf/.gq/.pw`) and suspicious patterns (raw
  IP, `verify account`, `secure login`, `update kyc`, `claim prize`, `free money`), adds a ⚠ badge,
  reports a `medium` risk to the worker. **No API calls** — lightweight/offline. Re-scans via a
  `MutationObserver` for SPAs.
- **Popup / options** (`popup/`, `options/`): UI + settings (API URL override).
- **API layer** (`src/api.ts`): `batchAnalyze` → `POST /api/extension/analyze` (Bearer JWT);
  `fetchExtensionConfig` → `GET /api/extension/config`.
- **Auth** (`src/auth.ts`): Supabase auth via REST, tokens in `chrome.storage`.
- **Config** (`src/config.ts`): Supabase URL + **anon key hardcoded** (intentional — public,
  RLS-protected); `DEFAULT_API_URL = http://localhost:5000` (must be overridden for production).
- **Security:** JWT/API-key auth on the analyze endpoint; content script does no network I/O;
  extension origins explicitly allowed by the backend CORS logic.

---

## 14. Android / mobile app

**Expo ~54 / React Native 0.81, Android-first**, expo-router file-based navigation. `mobile/AGENTS.md`
warns Expo has changed — read the versioned docs first.

- **Navigation** (`app/`): `index` (gate), `(auth)/{login,signup}`, `(tabs)/{home,scan,history,
  profile}`, `result`, `onboarding`, `phone-setup`, `permissions-setup`, `privacy-policy`, `terms`,
  `admin`. Root `_layout.tsx` shows a config-missing screen if Supabase env is absent, an animated
  auth splash while the session resolves, then a Stack navigator.
- **Auth** (`hooks/useAuth.ts`, `lib/supabase.ts`): Supabase with `expo-secure-store` token storage;
  401 → sign out + redirect to login.
- **API layer** (`lib/api.ts`): axios to the prod backend (`API_BASE` hardcoded); attaches the
  Supabase token; `scanContent` (JSON) and `scanImage` (multipart). History and profile read
  **directly from Supabase under RLS**. Admin stats/users/scans call the backend admin API.
- **State:** React Query (generous stale/gc to avoid flicker) + Zustand (`lib/store.ts`).
- **UI:** custom components (`components/ui/*`: GlassCard, GradientButton, RiskBadge, ThreatMeter,
  ScannerProgress, ReportModal, AppAlert); design tokens in `constants/colors.ts`; `mobile/docs/
  ui-design-system.md`.
- **Build:** `eas.json` (EAS Build); `app.json` (Expo config).
- **Security:** tokens in SecureStore; anon key in `eas.json` (public, RLS-safe).

> ⚠️ The mobile app shows drift/bugs vs. the current backend (see §24): free-plan daily limit shown as
> 5 (backend enforces 10), image uploads use field `image` (backend expects `file`), `submitFeedback`
> posts a shape the `/api/report` controller does not accept, and it reads `scans` columns not present
> in tracked migrations.

---

## 15. Self-hosted n8n

`infrastructure/n8n/` contains **setup files only** — the user must run n8n on their own always-on
host and build the workflow. Nothing in the app depends on n8n at runtime.

- **Architecture / hosting:** `docker-compose.yml` runs `n8nio/n8n:latest` on port 5678, persistent
  named volume, `restart: unless-stopped`. Documented deploy: an Oracle Cloud Always-Free VM behind a
  Cloudflare Tunnel for HTTPS. `.env.example` supplies `N8N_HOST`, `WEBHOOK_URL`, `GENERIC_TIMEZONE`,
  `N8N_ENCRYPTION_KEY`.
- **Triggers / workflows / automation:** the documented workflow (see `docs/n8n-self-hosted.md`) reads
  the `subscribers` table and broadcasts product-update emails. n8n uses its own DB role or the
  service key to read subscribers (RLS restricts that table to admins).
- **Credentials:** `N8N_ENCRYPTION_KEY` plus whatever DB/email credentials the user configures inside
  n8n; none are committed.
- **Current status:** **not deployed** — files exist, the workflow is not built. Diagnostics disabled.
- **Failure recovery / future:** `restart: unless-stopped` + persistent volume; the app degrades
  gracefully (no runtime dependency). Future: confirmed-subscribe (double opt-in), unsubscribe
  handling, richer campaigns.

---

## 16. Deployment

| Target | Where | How |
|---|---|---|
| **Frontend** | Vercel project "frontend" (root `frontend/`) | Auto-deploy on push to `main` via the Vercel GitHub App. Public `NEXT_PUBLIC_*` env baked in. Security headers in `next.config.ts` `headers()` + `vercel.json`. Live: `frontend-cyan-five-59.vercel.app`. |
| **Backend** | Vercel project "backend" (root `backend/`) | Express as a **serverless function** (`api/index.ts`); `vercel.json` rewrites all → the function (maxDuration 60). **Root dir must be `backend`** so the workspace dep `@neural-shield/types` resolves. Live: `backend-one-gamma-9n6duzcmcq.vercel.app`. |
| **Database** | Supabase project `jdcilinhabwilvbrjwjp` (ap-southeast-1) | `supabase db push` + `supabase functions deploy delete-account razorpay-checkout`. |
| **Container option** | Railway/Render/Fly | `backend/Dockerfile` (multi-stage, non-root, healthcheck) + `railway.toml` — recommended for reliable OCR. |
| **Local full-stack** | Docker | `docker compose -f docker-compose.dev.yml up --build`. |

- **CI** (`.github/workflows/ci.yml`): two jobs (frontend, backend). Root `npm ci`, then per-workspace
  type-check → lint → (backend) test → build. Runs on push to `main/develop/pranjal-dev/ritik-dev`
  and PRs to `main/develop`.
- **DNS / Cloudflare:** not configured in the repo (Vercel default domains). Cloudflare Tunnel is only
  referenced for exposing self-hosted n8n. **Custom domain/DNS: unable to determine from repository.**
- **Windows note:** run the Node toolchain from PowerShell (Git Bash on the build machine can't
  resolve `node`).

---

## 17. Third-party services

| Service | Purpose | Auth | Dependency / risk |
|---|---|---|---|
| **Supabase** | Postgres, Auth, Storage, edge functions | anon key (client, RLS), service role (edge functions only) | Core dependency; single live project. |
| **OpenRouter** | LLM explanations (multi-model) | `OPENROUTER_API_KEY` | Explanation only — outage degrades to templated text, never blocks a verdict. **A key was leaked in git history (see §19).** |
| **Google Safe Browsing** | Tier-1 URL blocklist | `GSB_API_KEY` | Key-gated; free API is non-commercial (must move to Web Risk for commercial use). |
| **URLHaus / PhishTank / OpenPhish** | Tier-1 phishing/malware feeds | optional keys/feed URLs | Fail-open; some off by default. |
| **Spamhaus / AbuseIPDB / VirusTotal** | Domain/IP reputation | `VIRUSTOTAL_API_KEY`, `ABUSEIPDB_API_KEY` | Key-gated; skipped if unset (lower coverage). |
| **RDAP / DNS / TLS** | Domain age, DNS, cert checks | none | Public; fail-open. |
| **Razorpay** | Payments (dormant) | `RAZORPAY_KEY_ID/SECRET` (edge secrets) | Superseded by UPI flow; edge function inert until secrets set. |
| **UPI (personal VPA)** | Active payments | `NEXT_PUBLIC_UPI_VPA/PAYEE` | Manual verification; QR via `api.qrserver.com`. |
| **api.qrserver.com** | Renders the UPI payment QR | none | External image dependency on the upgrade page. |
| **Sentry** | Error monitoring (web + backend) | DSN env | Optional. |
| **Vercel** | Hosting (web + backend) | project env | Deploy target. |
| **n8n** | Email automation | self-hosted | Not deployed; no runtime dependency. |

---

## 18. Payments

### 18.1 Current implementation — UPI + admin approval (active)

`PlanUpgrade.tsx` → `lib/payments.ts` → `payment_requests` table + `payment-proofs` bucket. Flow:

```mermaid
sequenceDiagram
  participant U as User
  participant FE as PlanUpgrade (web)
  participant DB as Supabase (RLS)
  participant AD as Admin (/admin/payments)
  U->>FE: pick paid plan
  FE->>FE: build upi://pay link + unique reference note + QR (qrserver)
  U->>U: pay by UPI app, screenshot
  U->>FE: enter UPI reference + upload screenshot
  FE->>DB: insert payment_requests (status=pending) + upload proof
  AD->>DB: admin_list_payments('pending')
  AD->>DB: admin_approve_payment(id)  -> set plan + reset daily/monthly counters
  Note over U: plan active on next token/profile refresh
```

Prices/quotas are the **single source of truth in `packages/config` `PLANS`**: Free ₹0, Individual
₹149, Two-person ₹219 (2 seats), Family ₹299 (4 seats), Pro ₹499. Amounts are fixed server-side.

### 18.2 Pricing / subscription architecture

- Plans are per-user quota (daily + monthly). Multi-user plans (Two-person/Family) let an owner link
  members by email; members inherit the owner's plan via `app_effective_plan`.
- History retention scales with plan (7 / 30 / 60 days); screenshot + QR scanners and PDF export are
  Pro-only.

### 18.3 Razorpay (dormant / superseded)

`supabase/functions/razorpay-checkout/index.ts` still exists: creates a Razorpay order and verifies
the HMAC signature, then upgrades the plan. It is **inert** until `RAZORPAY_KEY_ID/SECRET` are set, and
its `PRICES` map now mirrors the current catalog (individual/two_person/family/pro in paise) — the
`business` plan and stale `pro` price were removed on branch `security/production-hardening` so it
cannot mis-price if reactivated. `frontend/src/lib/billing.ts` (the client side of this)
is **dead code**. Future gateway strategy would re-activate an automated gateway to replace manual UPI
approval.

---

## 19. Security review

*(Findings only — nothing was changed.)*

### Strengths

- **No service-role key in the backend.** The API acts as the user under RLS; privileged ops go
  through `SECURITY DEFINER` RPCs with locked `search_path` and internal `is_admin`/key re-checks.
- **RLS on every user-facing table**, with defense-in-depth admin checks inside admin RPCs.
- **Plan escalation closed** (migration 0006 revokes `plan` UPDATE from users; verified 42501).
- **API keys stored only as SHA-256 hashes**; raw key shown once.
- **Prompt-injection resistance:** the LLM cannot emit a score and is told the raw input is untrusted.
- **Hardened HTTP surface:** Helmet CSP, normalized CORS allow-list, global + per-route rate limits,
  Zod validation with HTML-tag stripping, request size limits.
- **Fail-open collectors + AI fallback:** an outage lowers confidence or falls back to templated text
  rather than crashing a scan.
- Dev auth bypass is hard-disabled in production.

### Weaknesses / known risks

- **Leaked OpenRouter key in git history.** A previously-committed `backend/.env` key remains in
  history (history was scrubbed once per memory notes, but the README still warns to rotate). **Rotate
  and re-scrub before sharing the repo.**
- ~~**`daily_scan_count` / `monthly_scan_count` are user-updatable.**~~ **[FIXED — migration 0013]**
  Consumption moved to the `app_consume_scan_quota` `SECURITY DEFINER` function; the counter columns
  are now revoked from client UPDATE, so a client can no longer reset its own quota.
- ~~**CORS reflects any origin when the allow-list is empty.**~~ **[FIXED]** CORS now fails closed in
  production; only dev reflects an empty allow-list. (Still set `FRONTEND_URL` in prod.)
- ~~**Razorpay edge function references a non-existent `business` plan** and stale prices.~~
  **[FIXED]** `PRICES` now mirrors the current catalog (individual/two_person/family/pro) and drops
  `business`; the path stays dormant (503 until secrets set).
- **UPI approval is manual**; screenshot proof is trust-on-first-use (auto-verification is infeasible
  on personal UPI, as flagged in the design notes).
- **`api.qrserver.com`** is a third-party dependency embedded in the payment page.
- Free Google Safe Browsing API is **non-commercial** — a commercial launch needs Web Risk.
- Some collectors are key-gated; with keys unset, coverage (and confidence) silently drops.

### Hardcoded values / secrets

- Supabase **anon key** hardcoded in `extension/src/config.ts`, `mobile/eas.json`, `test-scan.mjs`
  — intentional and RLS-safe (public credential).
- Backend prod URL hardcoded in `mobile/lib/api.ts` and extension default (localhost).
- No private secrets are committed in the working tree (`.env`/`.env.local` are gitignored); the only
  secret exposure is the **historical** OpenRouter key.

---

## 20. Dependency analysis

### Critical dependencies

- **Runtime-critical:** `@supabase/supabase-js` / `@supabase/ssr` (auth + data on all clients),
  `express`, `zod`, `next`, `react`/`react-dom`, `@tanstack/react-query`, `axios`.
- **Engine-critical:** `tesseract.js` (OCR), `jimp` + `jsqr` (QR), OpenRouter via `fetch`.
- **Security-critical:** `helmet`, `express-rate-limit`.

### Notable / risk-flagged

- `multer@1.4.5-lts.1` and `jimp@0.22` are older major lines (jimp 0.22 is behind current jimp).
  Not upgraded (read-only session) — flag for maintenance.
- `tesseract.js` is heavy and unreliable on serverless (documented).
- **Dead / superseded packages of logic:** `frontend/src/lib/billing.ts` (Razorpay client) and the
  `subscriptions` table are effectively unused by the active UPI flow.
- Two plan-limit sources of truth (`packages/config` PLANS and `backend/src/config/plans.ts`) are kept
  **in sync manually** — drift risk (the backend cannot import the runtime package because it is
  tsc-compiled and Vercel-deployed).

### Unused / deprecated

- No automated dependency audit is in the repo. A precise "unused package" list would require a
  `depcheck` run (not performed — read-only). `packages/validation` and `packages/sdk` are wired into
  the frontend but **not** into the backend runtime (backend re-declares equivalents).

---

## 21. Environment variables

*(Purpose and required/optional only — no secret values.)*

### Backend (`backend/.env`)

| Var | Purpose | Required? |
|---|---|---|
| `NODE_ENV` | Environment; gates the dev auth bypass. | Recommended. |
| `PORT` | Listen port (default 5000). | Optional. |
| `APP_URL` | App URL; part of CORS allow-list + OpenRouter referer. | Recommended. |
| `FRONTEND_URL` | Deployed frontend origin(s), comma-separated — **required in prod** or CORS blocks the browser. | Prod-required. |
| `OPENROUTER_API_KEY` | LLM explanations. | Required for AI (falls back to templated if unset). |
| `OPENROUTER_MODELS` | Override the fallback chain. | Optional. |
| `OPENROUTER_TIMEOUT_MS` | Per-model timeout (default 25000). | Optional. |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Backend Supabase (RLS) client. | Required in prod. |
| `SUPABASE_SERVICE_ROLE_KEY` | Declared but **not read by the backend**. | Not used. |
| `LOG_LEVEL` | Winston level. | Optional. |
| `ENGINE_V2` | `true` = deterministic engine (default); `false` = legacy LLM scorer. | Optional. |
| `ENGINE_DISABLE_NETWORK` | Kill switch for all network collectors. | Optional. |
| `ENGINE_COLLECTION_BUDGET_MS` | Total network collection budget (default 4000). | Optional. |
| `RDAP_ENABLED` / `TLS_ENABLED` / `REDIRECT_ENABLED` | Toggle no-key collectors (default on). | Optional. |
| `URLHAUS_ENABLED` / `URLHAUS_AUTH_KEY` | URLHaus feed. | Optional. |
| `GSB_API_KEY` | Google Safe Browsing. | Optional. |
| `PHISHTANK_ENABLED` / `PHISHTANK_APP_KEY` | PhishTank. | Optional (off by default). |
| `OPENPHISH_ENABLED` / `OPENPHISH_FEED_URL` | OpenPhish. | Optional (off by default). |
| `VIRUSTOTAL_API_KEY` / `ABUSEIPDB_API_KEY` | VT / AbuseIPDB collectors. | Optional. |

### Frontend (`frontend/.env.local`)

| Var | Purpose | Required? |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Backend base (`/api`). | Required. |
| `NEXT_PUBLIC_APP_URL` | App URL. | Recommended. |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase browser client. | Required (auth). |
| `NEXT_PUBLIC_UPI_VPA` / `NEXT_PUBLIC_UPI_PAYEE` | UPI payee for the upgrade flow. | Required to enable upgrades. |

### Edge-function secrets (Supabase)

`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (dormant billing); `SUPABASE_URL` +
`SUPABASE_SERVICE_ROLE_KEY` are injected automatically. Mobile/extension use
`EXPO_PUBLIC_SUPABASE_*` / hardcoded anon key. n8n: `N8N_HOST`, `WEBHOOK_URL`, `N8N_ENCRYPTION_KEY`,
`GENERIC_TIMEZONE`.

---

## 22. Repository health

| Dimension | Assessment |
|---|---|
| **Code quality** | High. Consistent TS, thin controllers, typed engine, heavy doc-comments, standard envelopes. |
| **Architecture** | Strong. Clear separation (deterministic engine vs. LLM explainer), RLS-first security, shared type contract. |
| **Maintainability** | Good, with caveats: two plan-limit sources of truth, some cross-app client duplication (partly addressed by `packages/sdk`, not yet adopted by backend/mobile/extension). |
| **Scalability** | Good for current scale. Serverless backend + Postgres; OCR is the weak point on serverless. Collectors are timeboxed + cached. |
| **Security** | Strong model (no service role, RLS everywhere, hashed keys). User-updatable counters, empty-allow-list CORS, and dormant-Razorpay mispricing **fixed** on branch `security/production-hardening`. Remaining open item: rotate the leaked historical OpenRouter key (owner action). |
| **Documentation** | Excellent breadth (~50 docs incl. `docs/nsie/*`), but some docs describe the roadmap (ML) as if adjacent to reality — read carefully. |
| **Testing** | Backend only: `node:test` via tsx, ~180–195 tests (engine, intel, rules, risk, schemas, api, extension, reputation). Frontend/mobile/extension: no automated tests (E2E "planned"). |
| **Deployment** | Solid: CI green, Vercel auto-deploy for both apps, container fallback ready. |

**Overall health score (qualitative): ~8/10.** A well-architected, well-documented product with a
distinctive, defensible detection engine. Points off for the leaked-key remediation still being an
owner action, cross-client drift/bugs (mobile), dual sources of truth, and dormant-but-inconsistent
Razorpay code.

---

## 23. Technical debt

- **Two plan-limit sources of truth** (`packages/config` vs. `backend/src/config/plans.ts`),
  kept in sync manually.
- **Dead code:** `frontend/src/lib/billing.ts`, and the `subscriptions` table unused by the active
  UPI flow. (The Razorpay edge function's `business`/price mismatch was corrected on branch
  `security/production-hardening`.)
- **Client duplication:** web/mobile/extension each maintain near-identical scan clients;
  `packages/sdk` exists to unify them but is only partially adopted (frontend).
- **Mobile ↔ backend contract drift** (see §24) — the mobile app was built against an earlier/parallel
  contract.
- ~~**User-updatable scan counters**~~ **[RESOLVED — migration 0013]** consumption is now a
  `SECURITY DEFINER` function (`app_consume_scan_quota`) and the counter columns are revoked.
- **OCR on serverless** — Tesseract needs a container host for reliability.
- **Migration numbering collisions** (`0008/0009/0010/0011` each appear twice) — correct for immutable
  migrations but confusing; a future consolidation/reset would help onboarding.
- **Live schema drift:** columns the mobile app reads (`scans.signals/flags/explanation`,
  `profiles.phone`) are not in tracked migrations.

---

## 24. Known bugs

*(Discovered by reading — not fixed.)*

1. **Mobile image scan field mismatch.** `mobile/lib/api.ts` `scanImage` appends form field `image`,
   but the backend (`upload.middleware`) expects `file` (`.single("file")`) → "No image uploaded"
   (also Pro-gated, so free users hit 403 first).
2. **Mobile feedback shape mismatch.** `submitFeedback` posts `{ scanId, isAccurate, comment }` to
   `/api/report`, but `report.controller` requires `{ entityType, entityValue, reportType }` → 400.
3. **Mobile free-plan limit drift.** `PLAN_LIMITS.free = 5` in mobile vs. backend enforcing 10/day.
4. **Mobile reads columns not in tracked migrations** (`scans.signals/flags/explanation`,
   `profiles.phone`) — will error unless the live DB added them out-of-band (likely drift; unconfirmed
   from the repo).
5. ~~**Razorpay edge function** uses a `PRICES` map with `business` (removed plan) and a stale `pro`
   price.~~ **[FIXED]** `PRICES` now mirrors the current catalog on branch `security/production-hardening`.
6. **Extension default API URL is `localhost:5000`** — non-functional in production until overridden in
   options.
7. **Linked-member own plan stays `free`** so `PlanUpgrade` still offers upgrades to a member who
   already has an effective paid plan (noted as harmless in the build log).

---

## 25. Recommendations

**Critical**
- **Rotate the leaked OpenRouter key** and confirm history is clean before any external sharing.
- **Fix the Razorpay `business`/price inconsistency or delete the dormant billing path** to avoid
  reactivating a mispriced flow.

**High**
- **Fix mobile ↔ backend contract bugs** (§24 #1–#4) — image field, feedback payload, plan limit,
  and reconcile the `scans` columns (add real migrations or stop reading them).
- ~~Move scan-counter consumption to a `SECURITY DEFINER` RPC~~ **[DONE — migration 0013]**.
- ~~Require a non-empty CORS allow-list in production~~ **[DONE]** CORS fails closed in prod.
- **Adopt `packages/sdk`** across mobile + extension (and, with a build step, the backend) to kill
  client duplication and drift.

**Medium**
- Unify plan limits to one source of truth (generate the backend copy from `packages/config`).
- Add frontend/mobile/extension automated tests (at least smoke/E2E for the scan happy path).
- Move to Google **Web Risk** before any commercial launch; document required collector keys.
- Run the backend on a **container host** for reliable OCR.

**Low**
- Add a `depcheck`/`npm audit` step to CI; upgrade `multer`/`jimp`.
- Consolidate/renumber migrations at the next safe reset; delete the unused `subscriptions` table if
  Razorpay stays dormant.

---

## 26. Future architecture

*(Kept separate from current implementation.)*

- **NSIE v3 learned models** (`docs/nsie/*`): ONNX-served models as *additional signals* fused with the
  deterministic engine via a confidence engine and threat-fusion layer; MLOps + continuous-learning
  pipeline feeding on `scan_signals` + community `reports`. The deterministic path stays the source of
  truth.
- **Persistent cross-instance intel cache** (`entity_intel`) fully wired to replace the in-process
  cache, with a reputation graph over `domains/urls/emails/phone_numbers/upi_ids`.
- **Automated payment gateway** to replace manual UPI approval.
- **Physical monorepo restructure** (`frontend → apps/web`, etc.) staged in `docs/migration-guide.md`;
  deferred because it needs manual Vercel root-dir / EAS / extension-build changes.
- **Shared SDK adoption** everywhere; mobile + extension joining the workspace once Metro/hoisting is
  solved.
- **E2E test suite** and stronger observability.

---

## 27. Documentation coverage

- **Strong:** `docs/` holds ~50 markdown files — architecture, frontend, backend, database, auth,
  security, AI system, testing, devops, deployment, performance, blueprint, audits, trust-engine,
  scoring matrix, threat intelligence, reputation database, plans/billing, admin dashboard, n8n, plus
  the full `docs/nsie/*` ML design set. Root `README.md` and `DECISIONS.md` are thorough.
- **Gaps / to add:**
  - No **API reference doc** generated from routes (this file's §10 is the closest).
  - **DNS / custom domain / Cloudflare** setup is undocumented.
  - The **live schema drift** (mobile-only columns) is undocumented in migrations.
  - **Mobile** and **extension** have brief `AGENTS.md` but no architecture doc equivalent to the web
    backend docs.
  - Several docs describe **future ML** in present-tense-adjacent language; a "status: roadmap" banner
    would prevent misreading.
  - Inline code comments are dense in the engine but lighter in the mobile app.

---

## 28. Repository metrics

*(Estimated from the tracked file listing — approximate.)*

| Metric | Estimate |
|---|---|
| Apps / surfaces | 4 (web, backend, mobile, extension) |
| Shared workspace packages | 4 (types, config, validation, sdk) |
| Backend HTTP endpoints | ~21 |
| Backend route modules / controllers | 6 / 5 |
| Threat-intel collectors + intel sources | ~6 collectors + 8 intel modules |
| Frontend routes (App Router files) | ~30 |
| Frontend components | ~40 (17 UI + scanner/profile/landing/layout/auth/dashboard) |
| Database tables | ~20 (+ 2 storage buckets) |
| `SECURITY DEFINER` RPCs | ~20 |
| SQL migration files | 19 (adds `0013_scan_quota_consume_function`) |
| Edge functions | 2 (delete-account, razorpay-checkout) |
| Backend tests | ~180–195 (`node:test`) |
| Docs (markdown) | ~50 (incl. 14 under `docs/nsie/`) |
| Automation workflows (n8n) | 1 documented (subscriber broadcast), not deployed |
| Scanners | 7 (message, url, email, phone, upi, screenshot, qr) |

---

## 29. Founder notes

### How the whole thing works (one paragraph)

A user submits an artifact from any of the four clients. The client attaches a Supabase JWT (or an API
key) and calls the Express API. The API authenticates, enforces the user's per-plan quota, and runs the
**Trust Engine v2**: it normalizes the input, extracts embedded links/UPIs/phones, runs local rules +
structural checks, fires off threat-intel and reputation lookups in parallel (timeboxed, fail-open),
and computes every number deterministically from a **versioned weighted scoring matrix**. Only then
does an LLM (via OpenRouter) write a plain-language explanation — it can never change a score. The
result and its full evidence trail are saved to Postgres **as the user under RLS**. Reads (history,
profile, admin) go straight to Postgres under RLS or through `SECURITY DEFINER` RPCs. Payments are a
manual UPI + admin-approval flow.

### Onboarding a new developer

1. Read `README.md`, then **`DECISIONS.md`** (D1–D9) — they explain every non-obvious choice.
2. Read this file (`context.md`) end to end.
3. Skim `docs/trust-engine-architecture.md` and `docs/scoring-matrix.md` — the engine is the product.
4. **Windows:** use PowerShell for the Node toolchain.
5. Local setup: create/point at a Supabase project, `supabase db push`, deploy the two edge functions,
   fill `backend/.env` and `frontend/.env.local`, `npm install` at the root, then `npm run dev` in
   `backend/` (port 5000) and `frontend/` (port 3000). Without Supabase env the app still runs (dev
   auth bypass + "not configured" messaging).

### Where to start reading (code)

- **Detection:** `backend/src/threat-engine/index.ts` → `risk.ts` → `config/weights.ts` → `rules.ts`.
- **AI boundary:** `backend/src/services/ai.service.ts` (`explain()` + `templatedExplanation`).
- **Auth/security:** `backend/src/middleware/auth.middleware.ts` + `supabase/migrations/0001_init.sql`
  + `0006`/`0011`.
- **Plans/quota:** `packages/config/index.ts` + `backend/src/config/plans.ts` +
  `scan.service.checkAndConsumeLimits`.
- **Web app shell:** `frontend/src/proxy.ts` + `store/useAppStore.ts` + `services/scanner.ts`.

---

## 30. Glossary

| Term | Meaning |
|---|---|
| **Trust Engine v2 / NSIE** | The deterministic detection engine that produces every numeric verdict from typed Signals. The LLM only explains. |
| **Signal** | One typed fact contributing to risk (`id`, `category`, signed `weight`, `confidence`, `source`, `sourceTier`, optional `override`, `evidence`). The scan's `Signal[]` is its audit trail. |
| **Scoring matrix** | `config/weights.ts` — signal weights/caps/thresholds as *data*, versioned by `ENGINE_VERSION`. |
| **Effective weight** | `base weight × own confidence × source-tier multiplier` (tier 1/2/3 = 1.0/0.7/0.5). |
| **Override** | A verdict shortcut: `malicious` (tier-1 blocklist hit → R=100) or `allowlist` (caps R at 10). |
| **Risk score (R)** | 0–100 accumulated risk; `scamProbability = R/100`, `trustScore = 100 − R`. |
| **Confidence (C)** | 0–1 blend of coverage, source reliability, and signal agreement. |
| **Coverage** | Fraction of attempted, configured sources that returned without error (drives confidence). |
| **Collector** | A pluggable evidence source (RDAP, TLS, DNS, GSB, URLHaus, VirusTotal, …) that runs in parallel, timeboxed, and fails open. |
| **Fail-open** | A collector error lowers confidence but never crashes the scan. |
| **Templated explanation** | Deterministic fallback narrative when the LLM is unavailable — ensures a scan is never lost to an AI outage. |
| **RLS** | PostgreSQL Row-Level Security; every table policy keys on `auth.uid()`. |
| **SECURITY DEFINER RPC** | A Postgres function that runs with the definer's rights (locked `search_path`) to perform privileged, gated operations without giving the backend a service role. |
| **Effective plan** | The user's own plan, or a higher Two-person/Family plan they are a linked member of (`app_effective_plan`). |
| **Proxy (Next 16)** | What used to be `middleware.ts`; the route guard function `proxy` in `src/proxy.ts`. |
| **Dev auth bypass** | Non-production fallback that runs requests as a fixed dev user when Supabase is unconfigured. |
| **PSP** | UPI Payment Service Provider (the `@handle` suffix, e.g. `okaxis`, `ybl`). |
| **Entity** | A normalized, canonical artifact (url/domain/email/phone/upi/ip/text) ready for collection. |
| **Sub-entity** | A link/UPI/phone extracted from within a message or email and analyzed through the full pipeline. |
| **Engine version** | `trust-engine@2.1.4` at time of writing — bumps on every scoring change for reproducibility. |

---

*End of `context.md`. Treat this as the standing architectural reference; when the code and this
document disagree, verify against the code and update this file rather than assuming either is right.*
