# Recommended Architecture & Strategy

> **Task 10 deliverable.** The target architecture and the strategic answers:
> what to build first, what to delay, the moat, the biggest accuracy lever,
> defensibility, and the investor story. Synthesizes Tasks 1–9.

---

## 1. Target architecture (north star)

```
                ┌─────────────────────── CLIENTS ───────────────────────┐
                │  Web app (Next.js)        Chrome Extension (MV3)        │
                │  - 7 analyzers            - in-page banners/badges      │
                │  - dashboard/history      - one-tap report             │
                └───────────────┬───────────────────────┬────────────────┘
                                │  Bearer JWT / API key  │
                                ▼                        ▼
                ┌──────────────────────── API GATEWAY ───────────────────┐
                │  /scan/* · /extension/analyze (batch) · /reputation/:e  │
                │  /report · auth · rate-limit · cache-first              │
                └───────────────────────────┬────────────────────────────┘
                                            ▼
                ┌──────────────── TRUST ENGINE (deterministic) ──────────┐
                │  Normalize → Evidence Collection → Threat Intel        │
                │       → Rule Engine → Reputation Engine → Risk Engine  │
                │  outputs R, T, C, signals[]   (AI never scores)        │
                │  ── AI Explanation Layer (summary/recommendation only) │
                └───────┬───────────────────────────────┬────────────────┘
                        ▼                                ▼
        ┌──────────── DATA ────────────┐     ┌──────── EXTERNAL TI ───────┐
        │ Postgres (Supabase) + RLS     │     │ GSB/Web Risk, VirusTotal,  │
        │ reputation: domains/urls/     │     │ PhishTank, OpenPhish,       │
        │ emails/phones/upi/reports     │     │ URLHaus, Spamhaus, AbuseIPDB│
        │ scan_signals (audit trail)    │     │ RDAP (domain age)           │
        │ entity_intel (TTL cache)      │◄────┤ feeds ingested locally       │
        └──────────────────────────────┘     └─────────────────────────────┘
                        ▲
                async workers: feed ingestion, reputation recompute, OCR offload, calibration
```

Everything maps to the repo modules in
[`trust-engine-architecture.md`](trust-engine-architecture.md) §9 and the DB in
[`reputation-database.md`](reputation-database.md).

---

## 2. What should be built FIRST

Sequenced for fastest path to a *defensibly better verdict* (detail → roadmap in
[`implementation-prompt.md`](implementation-prompt.md)):

1. **Kill AI-as-scorer; stand up the Risk Engine skeleton** with the Rule Engine
   (promote `demo-analyze.ts` rules) + URL normalization/expansion. *Immediate
   accuracy + determinism win, no external deps.*
2. **RDAP domain age + Google Safe Browsing + URLHaus/PhishTank feeds.** *The
   highest-signal, mostly-free sources — biggest accuracy jump per unit effort.*
3. **Reputation DB + `scan_signals` + verdict-aware cache.** *Turns traffic into a
   compounding asset and makes verdicts auditable & cheap.*
4. **AI Explanation Layer refactor** (same OpenRouter fallback, new no-score prompt).
5. **Extension MVP: URL banners + one-tap report + reputation lookup.** *Distribution
   + the crowd-sourcing flywheel.*

> Rationale: items 1–3 raise accuracy and create the data asset before spending on the
> extension and paid TI. Each is shippable behind the `ENGINE_V2` flag
> ([`trust-engine-redesign.md`](trust-engine-redesign.md) §6).

---

## 3. What should be DELAYED

- **Paid/enterprise TI** (Web Risk commercial tier, VirusTotal Premium, OpenPhish
  premium) — adopt only when free tiers throttle real traffic.
- **Full website-content rendering / headless-browser analysis** — start with static
  fetch + structural heuristics; add rendering later for evasive pages.
- **Outlook/LinkedIn/job-portal adapters** — ship the *generic URL* extension first;
  add provider adapters once the URL flow + report loop prove out.
- **ML-learned weights / autoencoders** — only after thousands of labeled feedback
  rows exist; rule+reputation gets you most of the accuracy first.
- **Multi-language NLP, voice/call analysis, mobile apps** — explicitly out of scope.
- **Logistic score calibration** — needs labeled data; linear `P=R/100` is fine for v1.

---

## 4. What creates the MOAT

**The proprietary India-fraud reputation graph + the crowd-report flywheel.**
- TI feeds are commodities anyone can buy. The *unique* asset is the cross-entity,
  India-specific reputation DB (UPI IDs, phone numbers, scam-message template hashes,
  job-fraud recruiters) that **only grows with usage**
  ([`reputation-database.md`](reputation-database.md)).
- The extension's one-tap **Report** turns every user into a sensor; trusted-reporter
  weighting + community overrides ([`trust-engine-architecture.md`](trust-engine-architecture.md) §8)
  harden it against poisoning. More users → more reports → better verdicts → more
  users. Classic data network effect, and the category (UPI/India fraud) is one no
  incumbent serves ([`competitive-analysis.md`](competitive-analysis.md) §4).

---

## 5. What improves ACCURACY most

In priority order (effort-adjusted):
1. **Stop the LLM from scoring** (removes hallucinated/injectable verdicts — the single
   biggest correctness fix; see [`current-system-review.md`](current-system-review.md) §2.5).
2. **Domain age (RDAP) + GSB/phish feeds** — empirically the most predictive single
   signals for phishing.
3. **URL normalization + redirect/shortener expansion** — you can't score what you
   can't see (F-BE-2).
4. **Multi-source corroboration + confidence** — combining signals beats any one;
   confidence stops over-confident wrong answers.
5. **Reputation + feedback loop** — community reports catch what TI misses (zero-hour,
   India-specific) and the `feedback` table enables calibration (fixing dead loop F-DB-3).

---

## 6. What creates DEFENSIBILITY

- **Data moat** (§4) — compounding reputation graph.
- **Determinism & explainability as product** — "we show you the evidence and our
  scores are reproducible, not an AI guess" is a trust differentiator incumbents'
  black-box verdicts can't match, and it's hard to retrofit.
- **Distribution surface** — extension + public reputation/report API means partners
  (banks, marketplaces, payment apps) integrate NS, deepening the data moat (B2B2C).
- **India-fraud domain expertise** encoded in the rule engine + scoring matrix
  ([`scoring-matrix.md`](scoring-matrix.md)) — a curated, continuously-tuned asset.
- **Switching cost** for API/extension integrators once verdicts are embedded in their
  flows.

---

## 7. What attracts INVESTORS

- **Category creation in a huge, underserved market:** India digital-payment fraud is a
  large, growing, government-prioritized problem; **no incumbent covers UPI**
  ([`competitive-analysis.md`](competitive-analysis.md)).
- **Data-network-effect moat** with a clear flywheel and defensible IP (reputation
  graph) — the thing investors underwrite.
- **Multiple monetization paths:** consumer Pro (already built — Razorpay/plans), a
  **B2B reputation/scan API** (banks, fintech, marketplaces, recruiters), and
  extension-led growth — diversified, not single-SKU.
- **Technical credibility:** deterministic, auditable, injection-resistant engine
  (a security buyer's checklist) vs. competitors' "AI says so."
- **Capital efficiency:** free TI feeds + cache + own reputation keep COGS low; LLM
  used only for cheap explanations, not on the scoring hot path.
- **Traction-ready:** the existing web app + 7 analyzers + auth + billing means the
  team ships; the redesign is a focused upgrade, not a rewrite.

**One-liner for the deck:** *"Truecaller for everything that isn't a phone call —
the explainable, India-first scam graph for URLs, UPI, email and messages, in your
browser."*

---

*Next:* [`implementation-prompt.md`](implementation-prompt.md) (Task 11) — the
ready-to-run Claude Code implementation prompt + 4-week roadmap.
