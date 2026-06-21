# Deployment — Neural Shield AI

Targets: **Frontend → Vercel**, **Backend → Vercel** (serverless) or a **container host**
(Railway/Render/Fly — recommended for reliable OCR), **Database → Supabase**.

## Live (from build memory)

- Frontend: `https://frontend-cyan-five-59.vercel.app`
- Backend: `https://backend-one-gamma-9n6duzcmcq.vercel.app`
- Supabase project: `jdcilinhabwilvbrjwjp` (ap-southeast-1)

## Environment variables

### Frontend (`frontend/.env.local` / Vercel project env)

| Var | Example | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | public anon key |
| `NEXT_PUBLIC_API_URL` | `https://<backend>/api` | backend base URL |
| `NEXT_PUBLIC_APP_URL` | `https://<frontend>` | for metadata/OAuth |

### Backend (`backend/.env` / Vercel project env)

| Var | Required | Notes |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | yes | AI; **rotate the leaked key first** |
| `OPENROUTER_MODELS` | no | override fallback chain |
| `OPENROUTER_TIMEOUT_MS` | no | per-model timeout (default 25000) |
| `SUPABASE_URL` | yes | project URL |
| `SUPABASE_ANON_KEY` | yes | backend runs under user JWT (RLS) |
| `APP_URL` / `FRONTEND_URL` | yes | CORS allow-list |
| `NODE_ENV` | yes (prod) | disables the dev auth bypass |

> The backend does **not** use a service-role key. The service role is used only by edge
> functions (injected automatically by Supabase).

### Edge function secrets (Supabase)

`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (billing). `SUPABASE_URL` +
`SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

## 1) Local setup

```bash
# Database
supabase link --project-ref <ref>
supabase db push                       # applies supabase/migrations/0001..0006
supabase functions deploy delete-account
supabase functions deploy razorpay-checkout

# Backend
cd backend && npm install && cp .env.example .env   # fill values
npm run dev                                          # :5000

# Frontend
cd frontend && npm install && cp .env.example .env.local  # fill values
npm run dev                                          # :3000
```

Without Supabase env, the app still runs: auth pages show a "not configured" message and the
backend uses the dev auth bypass (non-prod only).

## 2) Staging

Use a Vercel preview + the shared Supabase project (or a separate Supabase project for true
isolation). Point the frontend preview's `NEXT_PUBLIC_API_URL` at the backend preview
function. Run the full CI matrix on the PR before promoting.

## 3) Production

```bash
# from each app dir, with a scoped token:
$env:VERCEL_TOKEN="..."   # PowerShell
npx vercel --prod --yes --scope <team>
```

- Set all env vars in the Vercel project settings (not committed).
- Add the production frontend URL to **Supabase → Auth → URL Configuration** (redirect URLs)
  and to the backend CORS allow-list (`APP_URL`/`FRONTEND_URL`).
- Apply any new migrations with `supabase db push`; deploy edge functions with
  `supabase functions deploy`.

### Container host (recommended for OCR)

`backend/Dockerfile` is a hardened multi-stage build (Alpine, non-root `app` user,
`/api/health` healthcheck, prod-only deps + compiled `dist`). Hosts inject `PORT` at runtime.

```bash
cd backend
docker build -t neural-shield-backend .
docker run -p 5000:5000 --env-file .env neural-shield-backend
# or: deploy via railway.toml on Railway
```

OCR (Tesseract) is unreliable on Vercel's read-only/cold serverless filesystem — run the
image scanners on the container host.

## Rollback

| Component | Rollback |
| --- | --- |
| Frontend / Backend (Vercel) | Vercel dashboard → Deployments → **Promote** a previous deployment (instant); or `vercel rollback` |
| Database | Migrations are forward-only; ship a **compensating migration**. For data, use Supabase PITR / a pre-change backup. Test destructive migrations on a branch/staging project first |
| Edge functions | Re-deploy the previous version from git (`supabase functions deploy <name>` on the prior commit) |
| Bad release (general) | revert the offending commit on `main` → CI + Vercel redeploy the previous good state |

## Pre-launch checklist

- [ ] Working tree committed; old JS prototype removed (see [project-audit.md](project-audit.md))
- [ ] OpenRouter key rotated; git history scrubbed
- [ ] All env vars set in Vercel + Supabase; `NODE_ENV=production`
- [ ] Production URL in Supabase redirect list + backend CORS
- [ ] Migrations `0001..0006` applied; edge functions deployed
- [ ] Leaked-password protection enabled; `0007` bucket hardening applied
- [ ] CI green; smoke-test health + an authenticated scan
