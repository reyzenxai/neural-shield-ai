# Troubleshooting

> Symptom → likely cause → fix. Keep this handy during deploys.

## Web app

**App shows "not configured" / blank auth**
- Cause: missing `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Fix: set them in the Vercel frontend project; redeploy.

**Browser calls to the API fail with a CORS error**
- Cause: the backend `FRONTEND_URL` doesn't include this origin. In production, CORS **fails closed**
  when the allow-list is empty/mismatched (by design, security branch).
- Fix: set `FRONTEND_URL` (comma-separated origins, no trailing slash needed) in the Vercel backend
  project; redeploy the backend.

**Logged out immediately / 401 loop**
- Cause: expired/again refresh token or clock skew.
- Fix: sign out and back in; check the device clock.

**OAuth (Google/GitHub) redirect fails**
- Cause: callback URL not allow-listed in Supabase Auth settings.
- Fix: add the exact `…/auth/callback` URL in Supabase → Authentication → URL configuration.

## Scanning

**Scan returns 502 "Analysis failed"**
- Cause: the engine threw (rare) or all AI models failed *and* something else broke. Note: the AI
  alone never causes a 502 (it falls back to templated text).
- Fix: check backend Sentry/logs; verify `OPENROUTER_API_KEY` and collector keys; check OpenRouter
  account model access.

**Scan returns 429 `DAILY_LIMIT_EXCEEDED`**
- Cause: the user hit their plan's daily/monthly cap (working as intended).
- Fix: none — the user upgrades or waits for the window reset.

**Screenshot/QR scan fails or is flaky**
- Cause: OCR (Tesseract) is unreliable on Vercel serverless.
- Fix: run the backend on a container host (`backend/Dockerfile`) for reliable OCR. Also these are
  Pro-gated (free users get 403 first).

**Explanations feel generic**
- Cause: primary model unavailable → templated fallback or a weaker model.
- Fix: check OpenRouter access; reorder `OPENROUTER_MODELS`.

## Quotas / plans

**A user's paid plan isn't active after payment**
- Cause: the UPI payment hasn't been approved yet, or the token/profile hasn't refreshed.
- Fix: approve it in `/admin/payments`; the user refreshes (re-login forces a token refresh).

**Scan counter seems stuck / wrong after deploy**
- Cause: migration 0013 (the consume RPC) not applied yet, or applied but backend not redeployed.
- Fix: `supabase db push`, then redeploy the backend. The backend falls back safely if the RPC is
  missing, but apply the migration so the counter columns are actually locked.

## Database

**A query returns nothing that "should" return rows**
- Cause: RLS is doing its job — you're querying as a user who doesn't own those rows.
- Fix: use the correct user context or a `SECURITY DEFINER` RPC for legitimate cross-user reads.
  Never disable RLS.

## CI / build

**Backend Vercel build fails resolving `@neural-shield/types`**
- Cause: wrong root directory.
- Fix: the backend Vercel project's **root directory must be `backend`**.

**`node` not found in Git Bash on Windows**
- Fix: run the Node toolchain from **PowerShell**.

Still stuck? See [monitoring.md](monitoring.md) for where the logs are, and
[incident-response.md](incident-response.md) if it's a security issue.
