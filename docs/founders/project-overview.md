# Project Overview

## What Neural Shield AI is

Neural Shield AI is an AI-powered scam and fraud detection product for the Indian market. A user
pastes something suspicious — a message, a link, an email, a phone number, a UPI ID, a screenshot,
or a QR code — and within seconds gets a clear verdict: how likely it is a scam (0–100%), a trust
score (0–100), a risk level (safe → critical), the exact red flags found, a plain recommendation,
and a scam-type label (phishing, fake KYC, UPI fraud, lottery, job/loan fraud, and so on).

## The four surfaces, one brain

Everything runs on **one backend and one database**:

1. **Website** (Next.js) — the launch product: landing, sign-up, dashboard, 7 scanners, history,
   profile, admin console.
2. **Backend API** (Express + TypeScript) — runs the detection engine and stores results.
3. **Chrome extension** — passively flags risky links as you browse.
4. **Mobile app** (Expo / React Native, Android-first).

Data, login, file storage, and privileged logic live in **Supabase** (a hosted Postgres database
with built-in auth and security).

## The one idea that makes it defensible

Most "AI" scam checkers just ask a language model "is this a scam, score it." That is easy to fool
(prompt injection) and impossible to audit. Neural Shield does the opposite:

- **Every number is calculated by rules + threat intelligence + reputation data** — deterministic,
  reproducible, and versioned. This is the **Trust Engine v2**.
- **The AI only writes the human explanation.** It is never allowed to produce or change a score.

So verdicts are consistent, explainable ("here is exactly why"), and can't be talked out of a
correct answer by a cleverly worded scam. See [trust-score-engine.md](trust-score-engine.md).

## How money works

Free tier plus four paid plans (Individual ₹149, Two-person ₹219, Family ₹299, Pro ₹499/month),
each with per-user scan quotas. Payment today is **UPI + admin approval**: the user pays by UPI,
uploads a screenshot, and an admin approves it in the admin console. A Razorpay integration exists
but is dormant. See [payments.md](payments.md).

## Security in one line

The backend never holds a Supabase "master key" — it acts as the logged-in user, and the database
itself enforces who can see what (Row-Level Security). Admin and privileged actions go through
locked-down database functions. See [security.md](security.md).

## Where the product is today

- Website + backend are live on Vercel; the database is one live Supabase project.
- The engine (detection) is the mature, well-tested core (~195 backend tests).
- Mobile and extension exist but the website is the current launch priority.
- ML ("learned models") is **documented roadmap**, not shipped — see [ml-engine.md](ml-engine.md).

## Reading order for a new founder/engineer
1. This file.
2. `../../DECISIONS.md` — why non-obvious choices were made.
3. `../../context.md` — the full architectural reference.
4. [trust-score-engine.md](trust-score-engine.md) — the engine is the product.
