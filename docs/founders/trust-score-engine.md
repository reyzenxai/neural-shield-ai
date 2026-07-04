# Trust Score Engine (Trust Engine v2 / NSIE)

> This is the product. Everything else is plumbing around it. The engine turns a suspicious
> artifact into a **deterministic, explainable verdict**. Code: `backend/src/threat-engine/`.

## The one rule

**Numbers are produced in exactly one place: `risk.ts`.** Nothing else — not the AI, not a
collector, not a controller — invents a score. This is what makes verdicts auditable and
reproducible.

## The pipeline (what happens on every scan)

1. **Normalize + extract** (`normalize.ts`). The input is canonicalized, and sub-entities are pulled
   out (links, UPI IDs, phone numbers inside a message/email) so each is analyzed through the full
   pipeline.
2. **Rule engine** (`rules.ts`). Local, offline linguistic + structural rules fire typed **signals**:
   OTP/PIN requests, fake KYC, urgency, lottery/KBC, job-fee, loan, payment pressure, unrealistic
   returns, off-platform, APK links, brand impersonation (SBI/HDFC/ICICI/Paytm/PhonePe/UIDAI/TRAI…),
   sender-domain mismatch, UPI rules (unknown PSP, collect-request, name/VPA mismatch), phone rules
   (invalid Indian format, premium prefix, sequential digits).
3. **Structural collector** — URL infrastructure: shortener, raw-IP host, punycode/homoglyph, brand
   in subdomain, suspicious TLD, `@` in URL, no TLS, deep subdomains.
4. **Network collectors** (`collectors/`, `intel/`) — run **in parallel, timeboxed, fail-open,
   cache-first**: RDAP (domain age), TLS, DNS, SPF/DKIM/DMARC, Google Safe Browsing, URLHaus,
   PhishTank, OpenPhish, Spamhaus, AbuseIPDB, VirusTotal.
5. **Reputation engine** (`reputation.ts`) — community reports (time-decayed, 14-day half-life) +
   cached entity intel.
6. **Compute risk** (`risk.ts`) — deterministic scoring (below).
7. **Explain** (`ai.service.explain`) — the LLM writes the human summary. **No numbers.**

## How the score is computed (`risk.ts`)

1. **Hard overrides.** A tier-1 blocklist hit (GSB/PhishTank/URLHaus/OpenPhish/community) with
   confidence ≥ 0.9 forces `riskScore = 100`. An allowlist override (verified org) caps risk at 10.
2. **Category-capped weighted accumulation.** Each signal's *effective weight* =
   `base weight × its confidence × source-tier multiplier` (tier 1/2/3 = 1.0/0.7/0.5). Positive
   contributions are summed per category and **capped** (e.g., blocklist 60, reputation 50, content
   35, pay 35, domain_age 30, infra 30, identity 30); negatives subtract freely. Clamp 0–100.
3. **Calibration.** `scamProbability = R/100`, `trustScore = 100 − R`, and a band from thresholds
   (critical ≥ 80, high ≥ 50, medium ≥ 20, low ≥ 5, else safe).
4. **Confidence** = weighted blend of coverage (0.45), source reliability (0.25), and signal
   agreement (0.30).

## Why "signals" matter

Every scan stores its full `Signal[]` trail in `scan_signals`. That means you can answer, for any
past verdict, *exactly why* it scored the way it did — and re-derive it. Each signal has an id,
category, signed weight, confidence, source, source tier, optional override, and evidence JSON.

## The scoring matrix is data, not code

`config/weights.ts` holds the weights, caps, and thresholds as **data**, versioned by
`ENGINE_VERSION` (e.g., `trust-engine@2.1.4`). Tuning a weight never touches logic, and the version
bumps on every change so old verdicts stay reproducible. **When you change weights, bump the
version.**

## Fail-open philosophy

If a collector errors or times out, it **lowers confidence** but never crashes the scan. If the AI
is down, `templatedExplanation` writes a deterministic summary. A scan is never lost to a dependency
outage.

## Knobs (env)

`ENGINE_V2` (deterministic vs legacy), `ENGINE_DISABLE_NETWORK` (offline mode),
`ENGINE_COLLECTION_BUDGET_MS` (total network budget), plus per-collector enable/key vars. See
[environment.md](environment.md).

## Extending it safely
- Add a new signal via `rules.ts` or a new collector in `collectors/`/`intel/` returning `Signal[]`.
- Give it a category, weight, and source tier in `config/weights.ts`; bump `ENGINE_VERSION`.
- Add tests (the engine has ~195 tests — keep the scoring-matrix regression test green).
- Never let a new source emit a final score — only signals.
