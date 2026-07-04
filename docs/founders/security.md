# Security (Founder Guide)

> Plain-language summary of how the product stays safe, what we changed for launch, and what you
> (the owner) still need to do. For the deep audit see `../security-audit.md`, `../owasp-report.md`,
> `../api-security.md`, `../ai-security.md`, and `../infrastructure-security.md`.

## The three pillars

1. **No master key in the backend.** The API acts as the logged-in user; the database enforces who
   can see what (RLS). A break-in on the API server cannot read everyone's data.
2. **Deterministic verdicts.** The AI only writes explanations — it can never change a score. So
   scammers can't "talk" the system into calling their scam safe (prompt injection is neutralized).
3. **Privileged actions are locked down** in the database (`SECURITY DEFINER` functions with
   internal permission checks), not sprinkled through app code.

## What we hardened for launch (security branch)

- **Scan-quota reset closed.** Users could previously reset their own scan counters and scan
  without limit. Now counters can only be changed by a locked database function.
- **CORS fails closed in production.** If the allowed-origins list is misconfigured, the API now
  refuses cross-site browsers instead of trusting anyone.
- **Dormant payment code de-risked.** The unused Razorpay path had wrong prices and a deleted plan;
  fixed so it can't mis-charge if ever switched on.
- **Full documentation** — threat model, OWASP mapping, per-endpoint review, and this runbook set.

## What you must still do (owner actions)

1. **Rotate the OpenRouter API key.** An old key leaked into git history. Issue a new one in the
   OpenRouter dashboard and set it in Vercel. (It's explanation-only, so it can't change verdicts —
   but it's a billable key.)
2. **Set production environment variables** in Vercel (especially `FRONTEND_URL`, or the browser
   gets CORS-blocked), and **apply migration 0013** (`supabase db push`).
3. **Before commercial launch:** move from Google Safe Browsing (free, non-commercial) to Google
   Web Risk (paid), and put the site behind **Cloudflare** for WAF + DDoS. Steps are in
   `../infrastructure-security.md`.

## Good habits

- Never commit `.env` files (they're gitignored — keep it that way).
- Never disable RLS to "quickly fix" a query.
- Keep secrets in Vercel/Supabase env, not in code. Only `NEXT_PUBLIC_*` is safe to expose.
- Rotate keys periodically and after any suspected exposure.
- Review admin access — only trusted people should have `is_admin = true`.

## If something goes wrong

See [incident-response.md](incident-response.md) for a step-by-step playbook (leaked key, account
takeover, data exposure, DDoS).

## Current posture

After the security branch: **~8.3/10**, no open critical/high *code* vulnerabilities in the website
path. Residual risk is mostly operational (the owner actions above). See
`../final-security-score.md`.
