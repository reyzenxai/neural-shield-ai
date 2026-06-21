# Implementation Prompt & Roadmap

> **Task 11 deliverable.** A self-contained prompt you can paste into Claude Code
> (in this repo) to execute the v2 redesign, plus a Week 1–4 roadmap. It is grounded
> in the real files audited in [`current-system-review.md`](current-system-review.md)
> and the designs in Tasks 2–10.

---

## Part A — How to use this

Paste **Part B** into Claude Code with this repo open. Work **one week at a time**:
finish a week, run the verification gate, commit behind the `ENGINE_V2` flag, then
start the next. Do **not** let the model do all four weeks in one pass — review each
PR. The redesign ships behind a flag so it can be A/B'd against today's LLM scorer
([`trust-engine-redesign.md`](trust-engine-redesign.md) §6).

---

## Part B — The implementation prompt (paste this)

````
You are working in the Neural Shield AI repository (Next.js frontend + TypeScript
Express backend + Supabase/Postgres). Read these design docs first and treat them as
the spec — do not re-derive them:
  docs/current-system-review.md       (what's wrong today, with file refs)
  docs/trust-engine-redesign.md       (PRINCIPLE: AI must NEVER produce a score)
  docs/evidence-collection-layer.md   (per-input-type collectors)
  docs/threat-intelligence.md         (external sources + tiers)
  docs/trust-engine-architecture.md   (pipeline + risk/confidence/reputation formulas)
  docs/scoring-matrix.md              (every weight/cap/override — load from config, don't hard-code)
  docs/reputation-database.md         (DDL, indexes, RLS, write-via-RPC)
  docs/chrome-extension.md            (MV3 design + required endpoints)

NON-NEGOTIABLE CONSTRAINTS
1. The AI (OpenRouter) MUST NOT generate scamProbability, trustScore, riskScore, or
   riskLevel. Those come ONLY from the deterministic engine (Evidence + Threat Intel +
   Rule Engine + Reputation). The AI writes summary, recommendation, and an advisory
   scamType label, reading already-decided evidence.
2. Ship everything behind an ENGINE_V2 env flag. When false, behavior is unchanged.
3. Preserve the security posture: backend holds no service-role key; all user data
   access stays under RLS; shared reputation tables are written ONLY via SECURITY
   DEFINER RPCs (mirror supabase/migrations/0005). Keep Zod validation, rate limits,
   audit logs, tests, and CI green.
4. Additive, non-breaking changes to the result contract. Extend ScanResult →
   ScanResultV2 (docs/trust-engine-redesign.md §5); the frontend must keep working.
5. Every verdict must be reproducible: persist the full Signal[] to scan_signals.
6. Each collector/source fails open (returns [] on error, recorded in
   decisionTrace.sourcesFailed) — never crash a scan; never silent-default a score to
   0.5/50 the way ai.service.ts normalize() does today.

DELIVERABLES BY MODULE (suggested paths from docs/trust-engine-architecture.md §9)
A. backend/src/engine/types.ts        — Signal, Entity, CollectionResult, ScanResultV2,
                                          SourceId, SignalCategory (shared with extension)
B. backend/src/engine/normalize.ts    — type detection + canonicalization (entity model,
                                          docs/evidence-collection-layer.md §2): URL punycode/
                                          PSL eTLD+1/tracking-strip, phone→E.164 (libphonenumber),
                                          UPI handle@psp, email, text→extracted sub-entities
C. backend/src/engine/rules.ts        — deterministic Rule Engine; PORT the rules in
                                          frontend/src/lib/demo-analyze.ts into typed Signals
                                          with ids/weights from docs/scoring-matrix.md §3.4
D. backend/src/engine/collectors/*    — one collector per source; Collector interface from
                                          docs/evidence-collection-layer.md §1:
                                          dns.ts, rdap.ts (domain age — do this first, high signal),
                                          tls.ts, redirect.ts (expand shorteners — fixes F-BE-2),
                                          structural.ts (homoglyph/IP-host/suspicious-TLD)
E. backend/src/engine/intel/*         — gsb.ts, urlhaus.ts, phishtank.ts, openphish.ts,
                                          virustotal.ts, spamhaus.ts, abuseipdb.ts; feeds ingested
                                          to entity_intel cache, NOT per-query on the hot path
F. backend/src/engine/reputation.ts   — read own reputation DB; compute Rep_risk via the
                                          formula in docs/trust-engine-architecture.md §8
G. backend/src/engine/risk.ts         — THE risk engine: overrides → category-capped
                                          accumulation → P/T/C/band (docs/...architecture.md §3,§5,§7).
                                          Loads weights from a versioned config file (engineVersion).
H. backend/src/services/ai.service.ts — REFACTOR: remove score fields from SYSTEM_PROMPT;
                                          new prompt = explanation only (docs/...architecture.md §6);
                                          input is structured signals + UNTRUSTED raw text marked as
                                          context; on failure return a TEMPLATED summary, never 502
                                          the whole scan. Keep the multi-model fallback.
I. backend/src/engine/index.ts        — orchestrator: normalize → collect (parallel, timeboxed,
                                          cache-first) → rules → reputation → risk → ai-explain →
                                          persist signals + upsert reputation. Replaces the scoring
                                          half of scan.controller.ts's runScan().
J. supabase/migrations/0008_reputation_engine.sql — exactly the DDL/indexes/RLS/RPCs in
                                          docs/reputation-database.md §3-§6 (threat_sources, domains,
                                          urls, emails, phone_numbers, upi_ids, reports, scan_signals,
                                          entity_intel; alter scans add risk_score/confidence/
                                          engine_version/primary_entity_*). Add RPCs:
                                          app_submit_report, app_record_signals, app_recompute_reputation.
K. backend/src/routes + controllers   — new endpoints (docs/chrome-extension.md §6):
                                          POST /api/extension/analyze (batch, cache-first),
                                          GET  /api/reputation/:type/:value,
                                          POST /api/report,
                                          GET  /api/extension/config
L. backend/src/services/scan.service.ts — extend saveScan to also write scan_signals and the
                                          new scans columns; wire the (currently dead) feedback
                                          path so labels can be collected for calibration.
M. extension/ (new package)           — MV3 skeleton per docs/chrome-extension.md §3-§5: service
                                          worker (auth/cache/batch), generic content adapter (URL
                                          banner + report button), popup sign-in. URL flow only first.

ENGINEERING RULES
- TypeScript strict; no new `any`. Match existing style (routes→controllers→services).
- Every external call: explicit timeout + AbortController (reuse the pattern in
  ai.service.ts:107-161), retries with backoff for idempotent GETs, circuit-breaker so a
  down source degrades confidence instead of failing the scan.
- Cache-first everywhere (docs/evidence-collection-layer.md §4): check reputation/entity_intel
  before any paid/rate-limited API; verdict-aware TTLs.
- Fix F-BE-6: make the daily-limit check atomic (UPDATE ... RETURNING or an RPC), not
  read-then-write.
- Add unit tests for: normalize.ts (URL/phone/UPI canonicalization), rules.ts (each signal
  fires correctly), risk.ts (overrides, caps, P/T/C math with the worked example in
  docs/trust-engine-architecture.md §4), and the explanation layer (asserts the AI output
  contains NO numbers). Keep the existing node:test suite green.
- Do NOT commit secrets. Note in the PR that the leaked OpenRouter key in git history must
  be rotated + history scrubbed (README §Security) — owner action, not code.

VERIFICATION GATE (run before each weekly commit)
- backend: npm run type-check && npm run lint && npm test  (all green)
- frontend: npm run type-check && npm run build
- Manual: with ENGINE_V2=true, scan the four DEMO_SAMPLES from demo-analyze.ts and confirm
  (a) scores come from signals (inspect scan_signals), (b) the AI output contains no numbers,
  (c) a dead TI source degrades confidence but doesn't error, (d) re-scanning a URL is served
  from cache. With ENGINE_V2=false, behavior is identical to today.

OUTPUT
Work module-by-module in the weekly order below. After each module: a short summary of files
changed, the verification result, and the next step. Open one PR per week against a feature
branch (never commit straight to main).
````

---

## Part C — 4-week roadmap

### Week 1 — Deterministic core (no external deps)
**Goal:** stop AI scoring; get a real engine producing reproducible numbers offline.
- Modules **A, B, C, G** (types, normalize, rules, risk engine) + the `ENGINE_V2` flag.
- Refactor **H** (`ai.service.ts`) to the explanation-only prompt; templated fallback.
- Migration **J** *partial*: `scan_signals` + new `scans` columns + `app_record_signals`.
- Wire orchestrator **I** for text/URL types using only rules + structural heuristics.
- Tests for normalize/rules/risk (incl. the §4 worked example) + "AI emits no numbers".
- **Exit:** with `ENGINE_V2=true`, message/URL scans are scored by the engine, evidence
  is persisted, AI only explains. Verification gate green.

### Week 2 — Threat intelligence + domain age
**Goal:** the biggest accuracy jump.
- Modules **D, E**: `rdap.ts` (domain age) first, then `dns/tls/redirect/structural`,
  then `gsb.ts`, `urlhaus.ts`, `phishtank.ts`, `openphish.ts` (feeds → `entity_intel`).
- `entity_intel` cache + verdict-aware TTL; parallel, timeboxed collection in **I**.
- Hard-override path in **G** wired to Tier-1 confirmed-malicious hits.
- **Exit:** a known-phishing URL hits the malicious override; a fresh domain raises
  risk via RDAP; dead sources degrade confidence only. Cache hit on re-scan.

### Week 3 — Reputation database + community loop
**Goal:** the moat.
- Finish migration **J** (all entity tables, `reports`, RPCs, indexes, RLS).
- Module **F** (reputation engine) + reputation signal/override math (§8).
- Endpoints **K**: `/reputation/:type/:value`, `/report`; wire **L** (feedback → labels).
- Reputation upsert after every scan; verdict-aware reputation cache as a collector.
- **Exit:** reporting an entity changes its next verdict; reputation lookup is O(1);
  abuse controls (dedup, rate-limit, trusted-reporter weighting) enforced in RPCs.

### Week 4 — Extension MVP + APIs + calibration prep
**Goal:** distribution + flywheel.
- `POST /api/extension/analyze` (batch, cache-first) + `/extension/config`.
- Module **M**: MV3 extension — service worker, generic URL adapter (banner + one-tap
  report), popup sign-in. URL flow only (Gmail/Outlook/LinkedIn/job adapters deferred,
  per [`recommended-architecture.md`](recommended-architecture.md) §3).
- Start logging engine `R` + LLM score + (when present) feedback labels for the future
  logistic calibration ([`scoring-matrix.md`](scoring-matrix.md) §6).
- **Exit:** the extension flags a malicious link in-page with an evidence-itemized
  banner and a working Report button; batch endpoint is cache-efficient; full
  verification gate green end-to-end.

### After week 4 (delayed by design)
Provider-specific extension adapters; paid TI tiers; headless content rendering;
logistic calibration + learned weights; B2B reputation API hardening. See
[`recommended-architecture.md`](recommended-architecture.md) §3.

---

*Index of all v2 docs:* [`v2-redesign-index.md`](v2-redesign-index.md).
