# Deployment

> Web + backend deploy to **Vercel**; the database is **Supabase**. A container option exists for
> reliable OCR. Nothing here should be a surprise if you read `../../context.md` §16.

## Targets

| Target | Where | How |
|---|---|---|
| **Frontend** | Vercel project `frontend` (root `frontend/`) | Auto-deploy on push to `main` via the Vercel GitHub App. Public `NEXT_PUBLIC_*` baked in. Live: `frontend-cyan-five-59.vercel.app`. |
| **Backend** | Vercel project `backend` (root `backend/`) | Express as a serverless function (`api/index.ts`); `vercel.json` rewrites all traffic to it (maxDuration 60). **Root dir must be `backend`** so `@neural-shield/types` resolves. Live: `backend-one-gamma-9n6duzcmcq.vercel.app`. |
| **Database** | Supabase `jdcilinhabwilvbrjwjp` (ap-southeast-1) | `supabase db push` + `supabase functions deploy delete-account razorpay-checkout`. |
| **Container option** | Railway/Render/Fly | `backend/Dockerfile` (multi-stage, non-root, healthcheck) + `railway.toml` — recommended for reliable OCR. |
| **Local full-stack** | Docker | `docker compose -f docker-compose.dev.yml up --build`. |

## CI (`.github/workflows/ci.yml`)

Two jobs (frontend, backend): root `npm ci`, then per-workspace type-check → lint → (backend) test
→ build. Runs on push to `main/develop/pranjal-dev/ritik-dev` and PRs to `main/develop`. Keep it
green before merging.

## Deploying the security branch (this PR)

1. **Review** the PR (`../pull-request.md`) — no merge yet.
2. **Apply the migration:** `supabase db push` (adds `app_consume_scan_quota`, revokes counter
   columns). The backend has a fallback so ordering is safe, but apply promptly.
3. **Set prod env** (Vercel backend): `NODE_ENV=production`, `FRONTEND_URL` (**required** — else
   CORS fails closed and blocks the browser), `APP_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
   rotated `OPENROUTER_API_KEY`.
4. **Merge to `main`** → Vercel auto-deploys frontend + backend.
5. **Smoke test:** sign in, run a scan of each type, hit a quota, confirm the admin console loads.

## First-time / from-scratch setup

1. Create (or point at) a Supabase project.
2. `supabase db push` to apply all migrations.
3. `supabase functions deploy delete-account razorpay-checkout`.
4. Fill `backend/.env` and `frontend/.env.local` ([environment.md](environment.md)).
5. `npm install` at the root; `npm run dev` in `backend/` (5000) and `frontend/` (3000).
6. In Vercel, create the two projects with the correct **root directories** and env vars.

## Custom domain / DNS / Cloudflare

Not configured in the repo (Vercel default domains today). Full step-by-step for a custom domain +
Cloudflare WAF/DDoS/TLS is in `../infrastructure-security.md` §3.

## Windows note

Run the Node toolchain from **PowerShell** (Git Bash on the build machine may not resolve `node`).

## Rollback

Vercel keeps previous deployments — use **Instant Rollback** in the dashboard to revert the frontend
or backend to the last good deploy. The migration is additive (a new function + column revoke); if
you must undo it, re-grant the counter columns and drop the function (see
[maintenance-guide.md](maintenance-guide.md)). See also `../pull-request.md` → Rollback Strategy.
