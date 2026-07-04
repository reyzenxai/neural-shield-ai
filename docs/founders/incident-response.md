# Incident Response

> A calm, step-by-step playbook for when something goes wrong. Print it or bookmark it. The goal:
> contain first, fix second, learn third.

## General procedure (any incident)

1. **Contain** — stop the bleeding (rotate a key, disable a feature, roll back a deploy).
2. **Assess** — what's affected, who's affected, is data exposed.
3. **Communicate** — if users are affected, be honest and prompt.
4. **Fix** — root-cause and patch.
5. **Review** — write a short post-mortem; add a safeguard so it can't recur.

## Playbooks

### A leaked/compromised secret (e.g., API key in a commit)
1. **Rotate immediately** in the provider dashboard (OpenRouter / Supabase / collector). The old key
   is dead the moment you rotate.
2. Update the value in Vercel/Supabase env; redeploy.
3. Remove the secret from the code and scrub git history if it was committed
   (`git filter-repo` / BFG), then force-push (coordinate with the team).
4. Check provider usage/billing for abuse during the exposure window.
> The known standing item: rotate the historically-leaked **OpenRouter** key. It's explanation-only
> (can't change verdicts) but it's billable.

### Suspected account takeover / auth abuse
1. In Supabase → Authentication, review the user's sessions; **sign them out everywhere** / disable
   the account if needed.
2. Check `audit_logs` / `admin_logs` for what was done.
3. Force a password reset; if OAuth, advise the user to review their Google/GitHub security.
4. Look for a broader pattern (credential stuffing) → consider enabling CAPTCHA/Turnstile on
   login/signup (roadmap item).

### Data exposure concern
1. Confirm the scope — remember RLS scopes data to `auth.uid()`, so cross-user exposure via the app
   is structurally hard. Check whether an admin RPC or a misconfigured policy is involved.
2. If a policy is wrong, fix it with a new migration (don't disable RLS).
3. If real PII was exposed, follow your legal/disclosure obligations and notify affected users.

### DDoS / traffic flood
1. If behind Cloudflare (recommended): raise the security level, enable "Under Attack" mode, tighten
   WAF rate-limit rules on `/api/*`. See `../infrastructure-security.md`.
2. App-level `express-rate-limit` and Vercel's edge absorb some load already.
3. Identify and block the source; scale is largely handled by Vercel serverless.

### Bad deploy / regression
1. **Vercel → Instant Rollback** to the last good deployment (frontend and/or backend
   independently).
2. Reproduce locally, fix, add a test, redeploy.

### Third-party outage (OpenRouter / threat-intel down)
1. Usually self-healing: collectors fail open (confidence drops) and the AI falls back to templated
   text — **scans keep working**.
2. If OpenRouter is fully down, explanations become templated; no action needed beyond monitoring.
3. If Supabase is down, the app can't authenticate/store — check Supabase status; there's no
   fallback for the primary datastore.

### Payment dispute / wrong approval
1. UPI approvals are manual — cross-check the `payment_requests` proof + `upi_reference` against your
   UPI statement.
2. To reverse: adjust the user's plan via the admin flow; the action is logged in `admin_logs`.

## Contacts / escalation
- **Hosting:** Vercel dashboard + status page.
- **Data/auth:** Supabase dashboard + status page.
- **AI:** OpenRouter dashboard.
- Keep an owner contact list and provider account access documented off-repo.

## After any incident
Write a 1-page post-mortem: what happened, timeline, impact, root cause, fix, and the safeguard
added. Update the relevant founder doc + `../../context.md` if the architecture changed.
