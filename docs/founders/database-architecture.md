# Database Architecture

> PostgreSQL via **Supabase**. Schema evolves through immutable, append-only migrations
> `supabase/migrations/0001..0013`. **Row-Level Security (RLS) is enabled on every user-facing
> table.** Live project: `jdcilinhabwilvbrjwjp` (ap-southeast-1).

## How to think about it

Two rules explain almost everything:

1. **RLS everywhere.** Each table has policies that key on `auth.uid()` (the logged-in user). A
   user can only ever touch their own rows. The backend uses the user's token, so it inherits these
   limits — there is no "god mode" connection in the API.
2. **Privileged work goes through `SECURITY DEFINER` functions (RPCs).** When something legitimately
   needs to cross users (admin reads, verifying an API key, approving a payment), it runs inside a
   database function that runs with elevated rights, has a **locked `search_path`**, and re-checks
   permissions internally.

## Core tables

| Table | Purpose | RLS |
|---|---|---|
| `profiles` | 1:1 with `auth.users`; app data (email, name, `plan`, `is_admin`, scan counters, avatar, prefs). | Own row select/update; **`plan` and scan-counter columns revoked** from client writes. |
| `scans` | One scan + verdict (inputs, scam prob, trust score, risk level, scam type, engine version). | Owner full CRUD. |
| `scan_flags` | Human-readable flags per scan. | Via parent scan owner. |
| `scan_signals` | **Evidence trail** — one row per signal (category, weight, confidence, source, evidence). | Via parent scan owner. |
| `feedback` | User feedback on a scan. | Owner. |
| `audit_logs` | User-scoped audit trail (backend writes as the user). | Own select + own insert. |
| `api_keys` | Pro API keys — stored as **SHA-256 hash only**. | Owner. |
| `admin_logs` | Admin action audit. | Admin select; self insert. |
| `subscriptions` | Legacy Razorpay subscription row (unused by the active UPI flow). | Owner. |

## Plans & payments

| Table | Purpose |
|---|---|
| `plan_memberships` | Multi-user plans (Two-person/Family): owner links members by email; 30-day change lock. |
| `payment_requests` | UPI upgrade requests (plan, amount, reference, screenshot path, status, reviewer). |
| `subscribers` | Newsletter emails from the landing page (admin-read only). |

## Reputation / threat-intel tables

| Table | Purpose |
|---|---|
| `threat_sources` | Registry of intel sources (gsb, urlhaus, phishtank, …). Public read. |
| `domains`, `urls`, `emails`, `phone_numbers`, `upi_ids` | Shared reputation state per entity. Public read; writes via RPC. |
| `reports` | User-submitted scam reports. Owner-only. |
| `entity_intel` | Per-source, verdict-aware TTL cache for external lookups. Public read; write via RPC. |

## Important functions & triggers

- `handle_new_user` (trigger on `auth.users`) — auto-creates the `profiles` row on signup.
- `resolve_pending_members` — links a member once their email signs up.
- `app_consume_scan_quota` (**migration 0013**) — atomically enforces + increments scan quotas so
  users cannot reset their own counters.
- RPCs: `app_effective_plan`, `app_verify_api_key`, `app_record_api_scan`, `app_link_member`,
  `app_submit_report`, `app_get_reputation`, `app_subscribe`, `admin_*` (stats/users/scans/
  payments/approve/reject), and more — all with locked `search_path` and internal authz checks.

## Storage buckets

- `avatars` — own-folder RLS.
- `payment-proofs` — private; own-folder insert, owner-or-admin read.

## Known drift (be aware)

Some columns the **mobile app** reads (`scans.signals/flags/explanation`, `profiles.phone`) are not
in the tracked migrations — likely added directly to the live DB. Treat them as "unconfirmed from
the repo." This is a mobile (Priority 3) concern, not a website blocker.

## Making schema changes safely

1. Never edit an old migration — add a new numbered file.
2. Keep RLS on. If a query fails, fix the policy, don't disable RLS.
3. For anything privileged, prefer a `SECURITY DEFINER` RPC with a locked `search_path`.
4. Apply with `supabase db push`; deploy edge functions with `supabase functions deploy`.
5. See [maintenance-guide.md](maintenance-guide.md) for backup/restore.
