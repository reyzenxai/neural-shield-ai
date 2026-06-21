# Supabase Edge Functions — Neural Shield AI

These Deno functions run on Supabase's edge runtime. They hold secrets the
Express backend and browser must never see (the service-role key; the Razorpay
secret).

| Function | `verify_jwt` | Purpose | Secrets used |
| --- | --- | --- | --- |
| `delete-account` | yes | Permanently delete the signed-in user (cascades to all their data). | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (auto-injected) |
| `razorpay-checkout` | yes | Create Razorpay orders + verify payment signatures, then upgrade the plan. | above + `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` |

## Deploy

```bash
supabase functions deploy delete-account
supabase functions deploy razorpay-checkout
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically. To
enable billing, set the Razorpay secrets (Dashboard → Project Settings → Edge
Functions → Secrets, or `supabase secrets set`):

```bash
supabase secrets set RAZORPAY_KEY_ID=rzp_test_xxx RAZORPAY_KEY_SECRET=xxx
```

Until the Razorpay secrets are set, `razorpay-checkout` returns `503` and the
in-app upgrade buttons show "Razorpay is not configured on the server."
