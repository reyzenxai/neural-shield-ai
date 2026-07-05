# Neural Shield AI — Future Upgrades

> Planned post-launch upgrades, captured before the 6 PM launch. Each item is scoped with
> what it involves, prerequisites, and who does what (owner vs. engineering). None of these
> block launch — the current website is production-ready without them.
> Last updated: 2026-07-05.

---

## 1. Trained ML layer — NSIE v3

**Goal:** add a learned model on top of today's deterministic Trust Engine, following the design
already written in `docs/nsie/*` (ml-architecture, model-training, model-deployment, model-security,
feature-engineering, continuous-learning, mlops, confidence-engine, data-pipeline, threat-fusion).

**Guiding constraint (must not break):** the model attaches as **one more signal**, never as the
final word. The deterministic engine (`backend/src/threat-engine/risk.ts`) stays the source of truth,
so verdicts remain auditable and prompt-injection-safe. Model output is fused via the confidence /
threat-fusion layer.

**What it involves:**
- A dataset built from the existing `scan_signals` evidence trail + community `reports`.
- Feature engineering + a training pipeline (offline), producing a **versioned, signed** model artifact.
- ONNX-runtime inference hooks in `backend/src/ml/` (today an intentional placeholder).
- Input/output validation on the feature vector; drift monitoring; MLOps for retraining.

**Prerequisites:** enough labelled scan history to train on; a place to run training (not on Vercel);
model-serving decision (in-process ONNX vs. a small inference service).

**Effort:** large, multi-phase. Ship behind a flag and compare against the deterministic baseline
before giving the model any weight. Reference: `docs/founders/ml-engine.md`.

---

## 2. Connect a custom domain to the Vercel deployment

**Goal:** serve the site on your own domain (e.g. `neuralshield.ai`) instead of
`frontend-cyan-five-59.vercel.app`.

**Owner steps (high level — full version in `docs/infrastructure-security.md` §3):**
1. Buy the domain; (recommended) put it behind **Cloudflare** for WAF + DDoS.
2. In Vercel → **frontend** project → **Settings → Domains** → add `neuralshield.ai` + `www`.
   Add the **backend** on a subdomain (e.g. `api.neuralshield.ai`) in the backend project.
3. Point DNS at Vercel's targets (CNAME `cname.vercel-dns.com`), proxied through Cloudflare.
4. Cloudflare **SSL/TLS → Full (strict)**, enable **Always Use HTTPS** + HSTS.
5. **Update env after the domain is live:** `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_URL` (frontend),
   and `FRONTEND_URL` / `APP_URL` (backend CORS) → the new origins. Add the new domain to Supabase
   **Auth → URL Configuration** (Site URL + wildcard redirect `https://neuralshield.ai/**`).

**Effort:** small; mostly dashboard + DNS + a few env changes. The main gotcha is updating every
place that references the old Vercel URL (CORS, Supabase redirect URLs, OAuth).

---

## 3. Connect self-hosted n8n to the website

**Goal:** run n8n on an always-on host and wire it to real automations (start with the newsletter
broadcast that reads the `subscribers` table).

**Current status:** **not deployed** — `infrastructure/n8n/` has setup files only; the app has no
runtime dependency on n8n.

**Owner steps (full detail in `docs/founders/self-hosted-n8n.md`):**
1. Provision an always-on VM (Oracle Cloud Always-Free works); install Docker + Compose.
2. Copy `docker-compose.yml` + `.env` (from `.env.example`); generate `N8N_ENCRYPTION_KEY`
   (`openssl rand -hex 32`) and **back it up**.
3. Expose over HTTPS via a **Cloudflare Tunnel** (never open port 5678); set `N8N_HOST` + `WEBHOOK_URL`.
4. `docker compose up -d`; create the n8n owner account immediately (strong password).
5. Add credentials (SMTP, DB read role limited to `subscribers`) and build the workflow.

**"Connect to the website" options:** n8n reads the DB directly (subscriber broadcasts), and/or the
website calls an n8n **webhook** (secured with a shared secret/HMAC) for events. Decide the specific
automations at that point.

**Effort:** medium; mostly owner infra + workflow building. No website code change strictly required.

---

## 4. OTP-based verification (replace the email confirmation link)

**Goal:** verify new sign-ups with a **6-digit OTP** instead of a click-through confirmation link.

**What it involves:**
- Supabase supports email OTP natively. Switch signup to `signInWithOtp` / `verifyOtp`
  (`supabase.auth.verifyOtp({ email, token, type: 'email' })`) instead of the confirmation-link flow.
- **Dashboard:** Authentication → Email Templates → **"Confirm signup"** / **"Magic Link"** template
  uses `{{ .Token }}` (the 6-digit code) instead of `{{ .ConfirmationURL }}`.
- **Frontend:** add an OTP-entry screen after signup (enter the 6-digit code → `verifyOtp` →
  session). Replace the current "check your email for the link" screen.
- Custom SMTP + sender name "Neural Shield AI" recommended alongside this (Project Settings → Auth).

**Effort:** small–medium; a Supabase config change + one new frontend screen + the verify call.
Reversible — can run alongside the link flow during transition.

---

## 5. Split the monorepo into 3 repositories

**Goal:** move from one root repo to three: **website** (this repo, stays), **chrome-extension**
(new), **mobile app** (new).

**Current state:** npm-workspaces monorepo — `frontend`, `backend`, `packages/*` are workspaces;
`mobile/` and `extension/` are already **excluded** from the workspace (they pin their own tooling),
which makes them clean candidates to extract. A staged plan already exists in `docs/migration-guide.md`.

**What it involves per new repo:**
- **Extension repo:** move `extension/` out with its own `package.json`, `build.mjs`, and CI. It
  depends on the shared scan contract — either vendor the needed types or publish
  `@neural-shield/types` / `@neural-shield/sdk` to a registry (or a git dependency) so the extension
  can consume them.
- **Mobile repo:** move `mobile/` out (Expo/EAS config travels with it). Same shared-types decision.
- **Website repo:** keep `frontend`, `backend`, `packages`, `supabase`, `docs`.
- **Shared code:** the cleanest long-term answer is to **publish `packages/types`, `packages/config`,
  `packages/validation`, `packages/sdk`** (npm or a private registry) and have all three repos depend
  on the published versions. Until then, the extension/mobile can pin a git-subpath dependency.
- Preserve git history when extracting (`git subtree split` or `git filter-repo`), then push each to
  its own GitHub repo. Re-point CI, Vercel (website), EAS (mobile), and the Chrome Web Store pipeline.

**Prerequisites:** decide how shared types/config are distributed (publish vs. git dependency) —
this is the crux. Do it when mobile/extension become active workstreams.

**Effort:** medium; mechanical but touches CI/deploy wiring for all three. No user-facing change.
Reference: `docs/migration-guide.md` and `docs/founders/folder-structure.md`.

---

## Sequencing suggestion

Post-launch, the low-risk / high-clarity items first: **#2 (domain)** and **#4 (OTP)** are small and
user-visible; **#3 (n8n)** is owner infra; **#5 (repo split)** when mobile/extension get active;
**#1 (ML)** is the big, staged program and should ride behind a flag against the deterministic baseline.
