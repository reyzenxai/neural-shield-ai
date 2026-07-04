# Self-hosted n8n

n8n is the automation layer for Neural Shield AI. It runs beside the app, not inside it,
and connects through webhooks and the Supabase database. This doc covers running it and
building the first workflow: emailing subscribers when you ship an update.

Files live in `infrastructure/n8n/` (a docker-compose and an env template).

## Why self-hosted

n8n's community edition is free to self-host, with no cap on workflows or runs. For a
security product that touches user emails and scam content, keeping the automation on your
own infrastructure is the right default (nothing flows through a third-party cloud, and the
cost stays flat as you grow). The trade-off is that you run a small always-on server.

## 1. Run it

On an always-on host (an Oracle Cloud Always Free VM is a good free option, or any small
VPS or an always-on machine you own):

```bash
cd infrastructure/n8n
cp .env.example .env      # fill in N8N_HOST, WEBHOOK_URL, N8N_ENCRYPTION_KEY
docker compose up -d
```

Generate the encryption key once with `openssl rand -hex 24` and keep it stable (changing it
makes saved credentials unreadable).

## 2. Give it a public HTTPS URL

Webhooks need a stable public URL. The simplest free option is a **Cloudflare Tunnel** to a
subdomain like `n8n.yourdomain.com`:

```bash
cloudflared tunnel --url http://localhost:5678
```

For production, create a named tunnel with a stable hostname (requires your domain on
Cloudflare's free plan) rather than a random quick-tunnel URL. Point `N8N_HOST` and
`WEBHOOK_URL` at that hostname.

## 3. Lock it down

On first launch, n8n asks you to create an owner account. Do that, use a strong password,
and put the instance behind Cloudflare Access (or a firewall rule) so only you can reach the
editor. Store all credentials (Supabase, email) in n8n's own encrypted credential store, not
in plain workflow fields.

## 4. Connect to Supabase

The workflows read from the Supabase database. Two options:

- **Postgres node with a least-privilege role (recommended).** Create a read-only role that
  can only read what a workflow needs, then use n8n's Postgres node with that role's
  connection string. This avoids handing n8n the service key.
- **HTTP node with the service key.** Call the Supabase REST API with the service role key,
  kept only in n8n's encrypted credentials. Simpler, but broader access.

Example read-only role for the subscriber list:

```sql
create role n8n_reader login password 'a-strong-password';
grant usage on schema public to n8n_reader;
grant select on public.subscribers to n8n_reader;
```

## 5. Workflow: email subscribers when you ship an update

The website already collects emails into `public.subscribers` (the subscribe form posts to
the `app_subscribe` RPC). This workflow sends them your update.

Nodes:

1. **Manual Trigger** (you run it when an update is ready). Later you can swap this for a
   webhook or a schedule.
2. **Set** node: put your update subject and body (HTML) here, so the content lives in one
   place. You can also read it from a "changelog" table if you prefer.
3. **Postgres** node: `select email from public.subscribers where confirmed = true and unsubscribed_at is null;`
4. **Loop Over Items** (batch of 1, or use the email provider's batch send).
5. **Email node** (Resend, SMTP, or Brevo): send the subject and body to each `email`.
   - Resend free tier is 3,000 emails per month and 100 per day, which is plenty early on.
   - Verify your sending domain (SPF and DKIM) so the mail does not land in spam. This
     matters a lot for a security brand.

Run the Manual Trigger to send. Test with your own email first by temporarily filtering the
Postgres query to a single address.

## Other workflows worth adding later

These reuse the same setup (Supabase Database Webhooks in, email or Telegram out):

- **Scam alert email:** a Supabase Database Webhook on a new high or critical `scans` row,
  into n8n, which emails the user (respecting `profiles.notification_prefs.scam_alerts`).
- **Weekly digest:** a schedule that reads each opted-in user's weekly stats and emails a
  summary (`notification_prefs.weekly_digest`).
- **Founder alerts:** new signups, new payments, or new feedback pinged to Telegram or Slack.

Secure every inbound Supabase webhook with a shared secret header that the first n8n node
checks, so nobody can trigger your workflows by guessing the URL.
