# Architecture Decisions — Neural Shield AI

This file records decisions where the build deviates from the original spec, and why.
Per the spec: "If any implementation detail is unclear, make the most production-appropriate
decision and document it in DECISIONS.md."

## D1 — Stack versions: keep Next 16 + Tailwind v4 (NOT Next 15 + Tailwind 3.4)
**Decision (confirmed with stakeholder):** Build on what is already installed and working —
Next.js 16.2.9, React 19.2.4, Tailwind CSS v4.3.1 — instead of downgrading to the spec's
Next 15 / Tailwind 3.4.

**Why:**
- The repo already runs Next 16 + Tailwind v4. Downgrading is pure risk with no upside.
- The Lovable design reference is **also** Tailwind v4 and defines its design tokens in CSS via
  `@theme` (OKLCH). Staying on v4 lets us port those tokens 1:1.

**Consequence:** There is **no `tailwind.config.ts`**. All design tokens, colors, fonts, radius,
shadows, and keyframes live in `frontend/src/app/globals.css` under `@theme` / `:root` — this is
the Tailwind v4 idiom and matches Lovable exactly.

## D2 — Auth: Supabase Auth (NOT custom JWT + bcrypt)
**Decision (confirmed):** Use native Supabase Auth for sessions.

**Why:** The spec mixed a custom JWT/bcrypt flow (`users.password_hash`) with Supabase RLS
policies keyed on `auth.uid()`. Those do not compose — a self-signed JWT never populates
`auth.uid()`, so the RLS policies as written would never match. Supabase Auth makes the RLS
policies work as written and gives Google/GitHub OAuth out of the box.

**Consequence (for Phase 2+):**
- The backend verifies the Supabase-issued JWT (via `supabase.auth.getUser(token)` /
  JWKS) rather than minting its own tokens. No `password_hash` column; Supabase `auth.users`
  owns credentials. A public `profiles` table (1:1 with `auth.users`) holds plan, scan counts, etc.
- Rate-limit keying still uses the authenticated user id from the verified Supabase token.

## D3 — Brand & design source of truth
Both the existing app and the Lovable export use the **"Neural Shield AI"** brand. This build
ports the polished Lovable visual system (cyan-mint `#00F5D4` primary, sky `#0EA5E9`,
violet `#7C3AED`, near-black navy `#050816` background, glassmorphism, glow shadows) into the
real Next.js app. The landing-page **content** follows the spec's India-market positioning
(₹ pricing, Indian scam patterns, 7 scanners); the **visual language** follows Lovable.

## D4 — Landing demo is frontend-only
The Phase-1 "Risk Score Demo" and hero scan preview run a local heuristic scorer with no API
call (per spec Section 4). The real AI analysis lands in Phase 3 against the backend.

## D6 — Phase 3 scanners: 5 text scanners shipped; screenshot/QR pro-gated
The 5 text-based scanners (message, URL, email, phone, UPI) are fully implemented end-to-end —
Zod-validated routes → OpenRouter AI service (multi-model fallback) → persistence → animated
result UI — and verified with live AI analysis (the SBI KYC test scores 0.95 / critical).

**Screenshot (OCR) and QR decode are intentionally pro-gated and "rolling out"** rather than
shipped half-working. Their extraction needs heavy, separately-verifiable dependencies
(Tesseract OCR; an image decoder + QR reader) and real sample images to validate — a focused
follow-up. The backend routes exist and return a clear `501 NOT_IMPLEMENTED` behind a Pro plan
gate; the frontend pages show an honest "Pro feature, rolling out" panel. This satisfies all of
the spec's measurable Phase-3 completion criteria (scam detection, validation, rate limiting,
consistent JSON) without claiming unverified OCR/QR accuracy.

## D9 — API keys, image scanners (OCR/QR), and Razorpay billing
- **Business API keys** now authenticate scan calls (`X-API-Key: nsk_...` or `nsk_`-prefixed
  Bearer). Since the backend is RLS-only (no service-role key), verification + persistence go
  through two `SECURITY DEFINER` RPCs gated by the key hash (`app_verify_api_key`,
  `app_record_api_scan`). API access requires the Business plan (403 otherwise).
- **Screenshot OCR** (Tesseract.js) and **QR decode** (jimp + jsQR) are implemented as real
  multipart uploads on `/api/scan/{screenshot,qr}`, Pro-gated. The English OCR model is fetched
  on first use. (Supersedes the D6 "rolling out" stub.)
- **Razorpay billing** runs entirely through a `razorpay-checkout` **edge function** (holds the
  Razorpay secret + service role) — order creation + HMAC signature verification + plan upgrade.
  The Express backend and the browser never see the Razorpay secret. **To activate, set
  `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` as Supabase edge-function secrets** (see supabase/README).
- **Security fix:** the `plan` column is now revoked from `authenticated` UPDATE (users could
  previously self-upgrade via RLS). Plan changes happen only in the edge function after a verified
  payment. Verified: a direct plan UPDATE now returns 42501 (permission denied).

## D8 — Phase 6: committed secret remediated + Dockerfile corrected
- `backend/.env` (containing the OpenRouter key) was **tracked in git and is in history**. Untracked
  it (`git rm --cached`); `.gitignore` already covers `.env`. **The OpenRouter key is still in git
  history and should be rotated**, and history scrubbed if the repo is shared.
- The spec's backend Dockerfile installed `--only=production` deps *before* `npm run build`, which
  fails (TypeScript is a devDep). Corrected to a multi-stage build (builder installs all deps +
  compiles; runner has prod deps + `dist` only, runs as a non-root user with a healthcheck).
- Security headers are set in **`next.config.ts` `headers()`** (host-agnostic) and mirrored in
  `vercel.json`.

## D7 — Backend stack: Express 4 + TypeScript (CommonJS)
The backend was rebuilt as TypeScript on **Express 4.21** (per the spec's pinned express@4.x) with
the full security stack (Helmet CSP, CORS, express-rate-limit, Winston, Zod). CommonJS module
output (not ESM/NodeNext) avoids `.js`-extension import friction. Auth verifies the Supabase JWT;
when Supabase is absent in non-production, a **DEV auth bypass** lets the scanner be exercised
locally (hard-disabled when NODE_ENV=production).

## D5 — Backend rebuild deferred to Phase 2/3
The current backend (`backend/`, plain JS + Express 5, single `/analyze` route) is left untouched
in Phase 1. It will be rebuilt as TypeScript + Express + Supabase with the full security stack in
later phases. The existing `globals.css` background bug (a `body::before` rule nested inside
`body {}`) is fixed by the Phase-1 `globals.css` rewrite.
