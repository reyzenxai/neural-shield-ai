# Neural Shield AI — Infrastructure Security

> Hosting, edge, DNS, TLS, headers, and WAF/DDoS. Includes precise **manual** owner steps for
> tasks that cannot be automated from the repo. Date: 2026-07-04.

---

## 1. Current infrastructure

- **Frontend:** Vercel project `frontend` (root `frontend/`), auto-deploy on push to `main`.
  Live: `frontend-cyan-five-59.vercel.app`.
- **Backend:** Vercel project `backend` (root `backend/`), Express as a serverless function
  (`api/index.ts`, `maxDuration 60`). Live: `backend-one-gamma-9n6duzcmcq.vercel.app`.
- **Database/Auth/Storage/Functions:** Supabase project `jdcilinhabwilvbrjwjp` (ap-southeast-1).
- **TLS:** terminated by Vercel and Supabase (managed certs, auto-renew).

---

## 2. Security headers (current)

**Frontend** (`next.config.ts` `headers()` + `frontend/vercel.json`):

- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` ✅
- `X-Frame-Options: DENY` ✅ (clickjacking)
- `X-Content-Type-Options: nosniff` ✅
- `Referrer-Policy: strict-origin-when-cross-origin` ✅
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` ✅
- `X-DNS-Prefetch-Control: on`

**Backend** (Helmet at the app layer): CSP, `X-Content-Type-Options`, cross-origin resource
policy, and the rest of Helmet's defaults. CORS fails closed in production (this branch).

**Gap:** the frontend `Content-Security-Policy` is not yet set at the edge (Helmet's CSP is on the
API, not the Next app). Adding a CSP to the Next app is a hardening backlog item (needs care with
Next/Sentry inline scripts — test with report-only first).

---

## 3. Recommended edge hardening — Cloudflare (manual)

Cloudflare in front of the custom domain adds WAF, DDoS protection, and DNS security. This is an
**owner action** (dashboard + registrar), not automatable from the repo.

### 3.1 Put the domain behind Cloudflare
1. Buy/choose a domain (e.g., `neuralshield.ai`).
2. Cloudflare dashboard → **Add a site** → enter the domain → choose the **Free** plan (enough to
   start).
3. Cloudflare shows two nameservers (e.g., `xxx.ns.cloudflare.com`). At your **domain registrar**
   (GoDaddy/Namecheap/etc.), replace the existing nameservers with these two. Save.
4. Wait for propagation (minutes–hours). Cloudflare emails when active.

### 3.2 Point DNS at Vercel
1. In Vercel: project **frontend** → **Settings → Domains** → add `neuralshield.ai` and
   `www.neuralshield.ai`. Vercel shows the target records.
2. In Cloudflare **DNS → Records**, add:
   - `CNAME  www   cname.vercel-dns.com`  (Proxy status: **Proxied**, orange cloud)
   - Root: use a `CNAME`/`A` per Vercel's instructions (Cloudflare supports CNAME flattening at
     root). Proxied.
3. For the API on a subdomain (recommended): add `api.neuralshield.ai` to the Vercel **backend**
   project and a corresponding proxied `CNAME api → cname.vercel-dns.com`.
4. **Common mistake:** leaving records "DNS only" (grey cloud) — then you get Vercel's cert but
   none of Cloudflare's WAF/DDoS. Keep them **Proxied** (orange).

### 3.3 TLS / HTTPS
1. Cloudflare **SSL/TLS → Overview** → set mode to **Full (strict)** (both hops encrypted, cert
   validated). *Never* use "Flexible" (it makes the browser→CF hop HTTPS but CF→origin HTTP).
2. **SSL/TLS → Edge Certificates** → enable **Always Use HTTPS** and **Automatic HTTPS Rewrites**.
3. Enable **HSTS** here too (mirrors the app header): Max-Age 6 months+, include subdomains,
   preload once you're confident.
4. Set **Minimum TLS Version** to 1.2.

### 3.4 WAF / DDoS / rate limiting
1. **Security → WAF → Managed rules** → enable the Cloudflare Managed Ruleset and OWASP Core
   Ruleset (start in *log* mode, then *block* after checking false positives).
2. **Security → DDoS** → managed DDoS protection is on by default for proxied traffic.
3. **Security → WAF → Rate limiting rules** → add a rule on `/api/*` (e.g., 100 req/min per IP →
   challenge/block). This complements the app-level `express-rate-limit`.
4. Consider a **Bot Fight Mode** / Turnstile challenge on `/login` and `/signup`.

### 3.5 DNS security
1. **DNS → Settings** → enable **DNSSEC**; Cloudflare shows a `DS` record to add at the registrar.
2. Keep email auth records (SPF/DKIM/DMARC) if you send mail (n8n campaigns) — see
   `automation-workflows.md`.

**Verification:** after setup, run `https://securityheaders.com` and `https://www.ssllabs.com/ssltest/`
against the domain; expect A/A+ with the headers above. Confirm `curl -I https://neuralshield.ai`
shows the HSTS + frame + nosniff headers and that HTTP redirects to HTTPS.

---

## 4. Vercel environment hygiene (manual)

In **each** Vercel project → **Settings → Environment Variables** (Production scope):

- **Frontend:** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_UPI_VPA`, `NEXT_PUBLIC_UPI_PAYEE`.
- **Backend:** `NODE_ENV=production`, `FRONTEND_URL` (**required** — the real frontend origin(s);
  without it, CORS now fails closed and the browser is blocked), `APP_URL`, `SUPABASE_URL`,
  `SUPABASE_ANON_KEY`, `OPENROUTER_API_KEY` (rotated), plus any collector keys.

**Common mistake:** forgetting `FRONTEND_URL` in prod → the browser gets CORS-blocked. This is
intentional fail-closed behavior; set the variable.

---

## 5. Supabase infrastructure

- **Database backups:** Supabase provides automated daily backups on paid tiers. **Owner action:**
  confirm the project is on a plan with the retention you need; test a restore once.
- **RLS:** enabled on all user tables (verified). Never disable it to "quickly fix" a query.
- **Storage:** `avatars` (own-folder), `payment-proofs` (private, own-folder + admin) — do not make
  buckets public.
- **Edge function secrets:** set `RAZORPAY_*` only if/when you reactivate that path (prices are now
  correct); `SUPABASE_URL` + service role are injected automatically.
- **Advisors:** run Supabase's Security & Performance advisors periodically (dashboard → Advisors).

---

## 6. Self-hosted n8n (if deployed)

See `self-hosted-n8n.md` for the full hardening guide (Cloudflare Tunnel, encryption key, basic
auth, no public port exposure). n8n has **no runtime dependency** from the app, so it is isolated.

---

## 7. Summary checklist

- [x] HSTS + frame + nosniff + referrer + permissions headers (frontend)
- [x] Helmet CSP + fail-closed CORS (backend, this branch)
- [ ] Cloudflare in front (WAF, DDoS, DNSSEC) — **owner**
- [ ] Custom domain + Full (strict) TLS — **owner**
- [ ] `FRONTEND_URL` + rotated keys set in prod — **owner**
- [ ] Confirm Supabase backups + test restore — **owner**
- [ ] Frontend CSP (report-only → enforce) — **backlog**
