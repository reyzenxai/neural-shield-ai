# Authentication

> The app uses **native Supabase Auth** — not a custom JWT/password system (decision D2).
> Credentials live in `auth.users`, and RLS policies key on `auth.uid()`. A hand-rolled JWT would
> never populate `auth.uid()`, so custom auth was rejected.

## How users sign in

- **Email + password:** `useAppStore.signUp` / `signIn` call `supabase.auth.signUp` /
  `signInWithPassword`. Email confirmation is supported (`needsEmailConfirmation` when no session
  is returned yet).
- **OAuth:** Google and GitHub via `supabase.auth.signInWithOAuth`. The redirect lands on
  `app/auth/callback/route.ts`, which exchanges the code for a session.

## Sessions & refresh

Supabase manages the session and token refresh. On top of that:
- **Web:** the axios client refreshes once on a 401.
- **Extension:** the background worker proactively refreshes ~5 minutes before expiry.
- **Mobile:** on a 401 it signs out and redirects to login.

## How the backend verifies a request

Two paths in `auth.middleware.ts`:

1. **API key** (`X-API-Key: nsk_...` or an `nsk_`-prefixed Bearer): the raw key is SHA-256 hashed
   and verified via the `app_verify_api_key` RPC. Requires the **Pro** plan (403 otherwise).
2. **Supabase JWT:** `verifyToken(token)` calls `supabase.auth.getUser(token)` (server-side
   validation on every request), then resolves the **effective plan** (own plan, or an inherited
   Two-person/Family plan via `app_effective_plan`) and the `is_admin` flag.

If validation fails → `401`. There is no way to forge a token the server will accept, because
`getUser` checks it against Supabase.

## Dev bypass (never in production)

When Supabase is not configured **and** `NODE_ENV != production`, requests run as a fixed dev user
(admin, free plan) so the scanner can be exercised locally. This is **hard-disabled in production**
(returns 503 if Supabase is missing).

## Edge functions & the service role

Two edge functions hold the Supabase **service role** (the powerful key) — and the Express backend
never does:
- `delete-account` — verifies the JWT, then does a service-role admin delete (FK cascade).
- `razorpay-checkout` — verifies the HMAC signature, then upgrades the plan.

## Security properties

- Passwords are never stored in app tables (Supabase handles hashing).
- Tokens are validated server-side each request, not just decoded.
- API keys are stored only as SHA-256 hashes; the raw key is shown once.
- The backend cannot escalate beyond the user it is acting as.

## Common issues
- **"Server auth is not configured" (503):** `SUPABASE_URL`/`SUPABASE_ANON_KEY` missing in prod.
- **OAuth redirect fails:** the callback URL must be allow-listed in the Supabase Auth settings.
- **Immediate logout / 401 loop:** clock skew or an expired refresh token — sign out and back in.

See [authorization.md](authorization.md) for what an authenticated user is then *allowed* to do.
