# Frontend Architecture

> The website is the launch product. Framework: **Next.js 16** (App Router, React Compiler on),
> React 19, TypeScript, Tailwind CSS v4, Zustand, TanStack React Query, Framer Motion, Recharts,
> Radix UI, Supabase JS, Sentry.

## ⚠️ This is not the Next.js you may know

Next 16 has breaking changes. Most importantly, the old `middleware.ts` is now **`proxy.ts`** (it
exports a function called `proxy`). Before editing framework-level code, read the versioned docs in
`frontend/node_modules/next/dist/docs/`. This is called out in `frontend/AGENTS.md`.

## Routing (App Router groups)

| Path group | Contents |
|---|---|
| `app/page.tsx` | Landing (hero, neural orb, risk demo, subscribe, pricing, FAQ). |
| `app/(auth)/` | login, signup, forgot-password + shared auth layout. |
| `app/(dashboard)/` | dashboard, history, profile, analyzer + 7 scanner pages + DashboardShell. |
| `app/admin/` | dashboard, users, users/[id], scans, feedback, logs, payments + AdminShell. |
| `app/auth/callback/route.ts` | OAuth / email-confirmation code exchange. |
| `app/api/og/route.tsx` | Dynamic Open Graph image. |
| `app/privacy`, `app/terms` | Legal pages. |

**Route guard** (`src/proxy.ts`): refreshes the Supabase cookie and redirects. Protected prefixes:
`/dashboard`, `/analyzer`, `/history`, `/profile`. Authenticated users on `/login` or `/signup` are
bounced to `/dashboard`. If Supabase env is missing, the guard is a no-op and the app still runs
with "not configured" messaging.

## State & data

- **Auth/session/profile:** Zustand store `store/useAppStore.ts` — bootstraps the Supabase session
  once, subscribes to `onAuthStateChange`, loads the `profiles` row, and exposes
  `signIn/signUp/signInWithOAuth/signOut/refreshProfile`.
- **Server state:** TanStack React Query (`hooks/useScans`, `useScanner`, `useAuth`).
- **Two data paths:**
  - **Reads** (dashboard, history, profile) go **directly to Postgres under RLS** via the Supabase
    browser client — fast, no backend hop.
  - **Scans** go **through the Express API** (which runs the engine and persists results).

## Networking

- `lib/api.ts` — axios instance that attaches the Supabase access token to every request and
  refreshes once on a 401.
- `services/scanner.ts` — JSON scans via axios; **image uploads via `fetch`** (so the browser sets
  the multipart boundary). The upload field name is **`file`**.
- Supabase clients: `lib/supabase/{client,server,config}.ts` (browser, SSR server, env guards).

## Components

- `components/ui/` — 17 primitives (Button, Card, Input, Modal, Alert, Badge, Progress, …).
- `components/scanner/` — ScannerShell, ResultCard/Panel, ImageScanner, ProScannerNotice.
- `components/profile/` — PersonalInfo, Notifications, ApiKeys, Security, DangerZone, PlanUpgrade,
  LinkedMembers.
- `components/landing/` — Navbar, NeuralOrb, HeroScanPreview, RiskDemo, Subscribe.
- `components/layout/` — DashboardShell (sidebar + mobile drawer), AdminShell, Logo.
- `components/dashboard/widgets.tsx` — StatCard, RiskDonut, TypeBreakdown (Recharts).

## Theme

Tailwind v4 with tokens in `globals.css` (`@theme`, OKLCH): cyan-mint primary `#00F5D4`, sky, violet,
near-black navy background, glassmorphism, glow shadows. Ported 1:1 from the Lovable design
reference (see `DECISIONS.md` D1/D3).

## Security-relevant frontend notes

- No `dangerouslySetInnerHTML` on user content; React auto-escapes.
- Only `NEXT_PUBLIC_*` env is exposed to the browser (public by definition — Supabase anon key,
  API URL, UPI payee). Nothing secret is in the client bundle.
- Security headers (HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy) are
  set in `next.config.ts` and `frontend/vercel.json`.

## Common issues
- **Blank/"not configured" app:** missing `NEXT_PUBLIC_SUPABASE_*` — see [environment.md](environment.md).
- **CORS error calling the API:** backend `FRONTEND_URL` must include this origin (prod fails
  closed). See [troubleshooting.md](troubleshooting.md).
- **Editing framework code with old assumptions:** read `node_modules/next/dist/docs/` first.
