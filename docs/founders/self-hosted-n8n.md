# Self-Hosted n8n

> n8n is an automation tool (like Zapier, but self-hosted). We use it for **email automation**
> (e.g., broadcasting product updates to newsletter subscribers). **It is not deployed yet** and the
> app has **no runtime dependency** on it — if n8n is down, nothing in the product breaks.
> Files: `infrastructure/n8n/` (setup only — you run it on your own host).

## Architecture

- `docker-compose.yml` runs `n8nio/n8n:latest` on port 5678 with a persistent named volume and
  `restart: unless-stopped`.
- Documented deploy: an **Oracle Cloud Always-Free VM** behind a **Cloudflare Tunnel** for HTTPS
  (so you never expose port 5678 to the internet).
- `.env.example` supplies `N8N_HOST`, `WEBHOOK_URL`, `GENERIC_TIMEZONE`, `N8N_ENCRYPTION_KEY`.

## The documented workflow

Read the `subscribers` table (newsletter emails captured on the landing page) and broadcast a
product-update email. n8n connects to the database with its own role / the service key to read
subscribers (that table is admin-restricted under RLS). Nothing is committed — you build the
workflow inside n8n.

## Setup (manual, owner)

1. **Provision a host** — an always-on VM (Oracle Cloud Always-Free tier works). SSH in, install
   Docker + Docker Compose.
2. **Copy the compose files** from `infrastructure/n8n/` to the VM.
3. **Create `.env`** from `.env.example`. Generate a strong `N8N_ENCRYPTION_KEY`
   (e.g., `openssl rand -hex 32`) — this encrypts stored credentials; **back it up**, losing it
   means re-entering all credentials.
4. **HTTPS via Cloudflare Tunnel** — install `cloudflared`, `cloudflared tunnel login`, create a
   tunnel, and route your `N8N_HOST` (e.g., `n8n.neuralshield.ai`) to `http://localhost:5678`. Set
   `WEBHOOK_URL` and `N8N_HOST` to the public HTTPS URL. **Do not** open port 5678 in the VM
   firewall — only the tunnel reaches it.
5. **Start:** `docker compose up -d`.
6. **First login** — set the n8n owner account immediately (n8n's built-in user management). Use a
   strong password. Enable n8n basic-auth/user-management so the editor isn't open.
7. **Add credentials** inside n8n (SMTP/email provider, database) — they're encrypted at rest with
   your `N8N_ENCRYPTION_KEY`.
8. **Build the workflow** (read subscribers → send campaign). Test with a small list first.

## Security hardening (do all of these)

- **Never expose port 5678 publicly.** Only reach it through the Cloudflare Tunnel (or a reverse
  proxy with auth + TLS).
- **Enable authentication** (n8n user management / basic auth) — an open n8n editor is remote code
  execution.
- **Protect the encryption key** — back it up in a password manager; it's the master secret for all
  stored credentials.
- **Least privilege DB access** — give n8n a role that can read only what it needs
  (`subscribers`), not a full admin role, if feasible.
- **Secure webhooks** — if you add webhook triggers, require a secret/HMAC and validate it.
- **Keep it updated** — `docker compose pull && docker compose up -d` periodically; pin a version
  tag rather than `latest` for reproducibility.
- **Backups** — the named volume holds workflows + encrypted credentials; snapshot it regularly.
- **Disable telemetry/diagnostics** if you prefer (`N8N_DIAGNOSTICS_ENABLED=false`).

## Failure recovery

`restart: unless-stopped` + the persistent volume mean n8n comes back after a reboot with its
workflows intact. Because the app doesn't depend on n8n at runtime, an n8n outage only delays
email campaigns.

## Status & future

Not deployed; the workflow isn't built yet. Future: double opt-in (confirmed subscribe),
unsubscribe handling, richer campaigns. See [automation-workflows.md](automation-workflows.md).
