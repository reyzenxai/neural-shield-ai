# Supabase setup — Neural Shield AI

The app uses **Supabase Auth** (decision D2 in `/DECISIONS.md`). Credentials are stored in
Supabase's `auth.users`; a 1:1 `public.profiles` row holds app data and is created automatically
by a trigger on signup.

## 1. Create a project
1. Create a project at https://supabase.com.
2. Copy the **Project URL** and **anon public** key (Project Settings → API).
3. (Backend, later phases) also copy the **service_role** key.

## 2. Run the schema
Open the SQL editor and run [`migrations/0001_init.sql`](migrations/0001_init.sql), or with the CLI:

```bash
supabase link --project-ref <ref>
supabase db push
```

## 3. Configure auth
- **Email**: Authentication → Providers → Email (enable). For local dev you can turn off
  "Confirm email" so signups log in immediately.
- **OAuth** (optional): enable Google and/or GitHub under Providers and set the redirect URL to
  `http://localhost:3000/auth/callback` (and your production URL).
- **Redirect URLs**: Authentication → URL Configuration → add `http://localhost:3000/**`.

## 4. Set frontend env
Copy `frontend/.env.example` → `frontend/.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Restart `npm run dev`. Until these are set, auth pages render but submitting shows a clear
"Supabase is not configured" message (the rest of the app still works).

## 5. Edge functions
Two edge functions ship with the app (deploy with `supabase functions deploy <name>` or via the
Supabase MCP):
- **`delete-account`** — permanently deletes the signed-in user (account deletion).
- **`razorpay-checkout`** — creates Razorpay orders and verifies payments, then upgrades the plan.

### Razorpay billing (optional)
To enable paid upgrades, create a Razorpay account (test mode is fine) and set its keys as
**edge-function secrets** (Dashboard → Project Settings → Edge Functions → Secrets, or
`supabase secrets set`):

```
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=xxx
```

No frontend or backend env is needed — the public key id is returned by the edge function. Until
these are set, the in-app "Upgrade" buttons show "Razorpay is not configured on the server."
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected into edge functions automatically.
