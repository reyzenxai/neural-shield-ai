# Automation Workflows

> What runs automatically, on a schedule, or in response to events. Today this is deliberately
> minimal — the product avoids hidden background magic.

## In-app automation (Supabase)

- **`handle_new_user`** — a database trigger on `auth.users` that automatically creates the
  `profiles` row when someone signs up. Users never exist without a profile.
- **`resolve_pending_members`** — a trigger on `profiles` that back-fills a `plan_memberships` row's
  `member_id` when a previously-invited email finally signs up (so shared-plan invites "just work"
  once the member joins).
- **`set_updated_at`** — keeps `profiles.updated_at` current.
- **Quota windows** — daily/monthly scan counters reset lazily inside `app_consume_scan_quota` when
  their window elapses (no cron needed).

These are all in the database migrations; they're reliable and need no external scheduler.

## Email automation (n8n — planned)

The one external automation is the newsletter broadcast (read `subscribers` → send a campaign),
built in **self-hosted n8n**. It is not deployed yet and the app doesn't depend on it. Full setup +
hardening: [self-hosted-n8n.md](self-hosted-n8n.md).

Planned enhancements:
- **Double opt-in** — confirm the subscriber's email before adding them to campaigns.
- **Unsubscribe handling** — one-click unsubscribe + suppression list (needed for deliverability /
  anti-spam compliance).
- **Segmented campaigns** — e.g., only free users, or users in a region.

## CI/CD automation (GitHub Actions)

On push/PR, CI runs type-check → lint → test → build for frontend and backend. Vercel auto-deploys
`main`. See [deployment.md](deployment.md).

## What we intentionally do NOT automate (yet)

- **Payment verification** — UPI approvals are manual by design (a human checks the proof). See
  [payments.md](payments.md).
- **Plan changes** — only via admin approval or the (dormant) Razorpay verify path.
- **Model retraining** — no ML in production; see [ml-engine.md](ml-engine.md).

## If you add a new automation
- Prefer database triggers/RPCs for in-app logic (they inherit RLS + run close to the data).
- For external automation (n8n/cron), give it least-privilege DB access and secure any webhooks.
- Log it and add it to [monitoring.md](monitoring.md) so a silent failure is visible.
