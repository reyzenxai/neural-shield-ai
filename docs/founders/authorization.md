# Authorization

> Authorization is enforced in **three layers**: RLS at the database, `SECURITY DEFINER` RPCs for
> privileged/cross-user work, and middleware gates in Express. Defense in depth — bypassing one
> layer still hits the next.

## Roles

| Role | How set | Can do |
|---|---|---|
| **Anonymous** | no session | Landing page, public reputation lookup, subscribe, extension `/config`. |
| **Authenticated user** | Supabase session | Own scans/history/profile/reports/feedback; submit UPI payment; link members (on a multi-user plan). All scoped by RLS to `auth.uid()`. |
| **API-key holder (Pro)** | valid `nsk_` key | Programmatic scans only (no reports — reports require a JWT). |
| **Admin** | `profiles.is_admin = true` | Admin console reads + approve/reject UPI payments, via `requireAdmin()` and admin RPCs that re-check `is_admin` internally. |
| **Founder / owner** | Supabase project owner + admin flag | Everything an admin can, plus out-of-band ops the app can't do (rotate keys, set env, run migrations, deploy functions, run n8n). |

## Enforcement points

- **Plan gating:** `requirePlan(['pro'])` on `/scan/screenshot` and `/scan/qr`; API access requires
  Pro (checked in `authenticate`).
- **Quotas:** enforced by `app_consume_scan_quota` (migration 0013) — atomic and **un-bypassable**
  (the counter columns are revoked from client writes). Free 10/day; Individual 30/day, 150/mo;
  Two-person 22/day, 110/mo; Family 15/day, 75/mo; Pro unlimited.
- **Plan escalation prevention:** the `plan` column is revoked from client UPDATE (migration 0006).
  Plans change only via `admin_approve_payment` or the Razorpay edge function.
- **Admin RPCs** all `RAISE EXCEPTION '42501'` if `admin_is_admin()` is false — so even if the
  Express `requireAdmin()` gate were somehow bypassed, the database refuses.

## The key idea: IDOR is structurally blocked

Because the backend acts *as the user* and RLS keys on `auth.uid()`, there is no query the API can
run that returns another user's data. Trying to fetch `scans` for a different `user_id` simply
returns nothing. This is why the audit rates access control highly.

## What changed on the security branch

Previously a user could reset their own scan counters with a plain `UPDATE` (the columns were
granted so the backend could meter). Now the counters are revoked and only the
`app_consume_scan_quota` `SECURITY DEFINER` function can touch them — closing a real quota-bypass /
cost-abuse hole. See `../security-audit.md` §3.1.

## Adding a new privileged action (recipe)
1. Prefer a `SECURITY DEFINER` RPC with `set search_path = public` and an internal permission check.
2. Grant `execute` only to `authenticated` (or nobody + call from an edge function for service-role
   work).
3. Never grant broad table UPDATE to `authenticated` for sensitive columns — grant column-level.
4. Add a matching Express gate (`requirePlan` / `requireAdmin`) for a fast, clear 4xx.
