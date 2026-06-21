# Neural Shield AI — v2 Redesign (Trust Engine)

> Index for the evidence-based detection redesign. The throughline across all 11
> documents: **the AI never produces a score** — it only explains, summarizes, and
> recommends. Every verdict comes from
> `Evidence Collection + Threat Intelligence + Rule Engine + Reputation Engine`,
> making it deterministic, reproducible, auditable, and injection-resistant.

**Scope (locked):** Website · Chrome Extension · Backend APIs · Threat Intelligence ·
Reputation Engine · Trust Engine. **No** Android/iOS apps.

---

## The documents

| # | Task | Doc | What it answers |
|---|---|---|---|
| 1 | Audit | [`current-system-review.md`](current-system-review.md) | What's wrong with the system as built (with file refs). Core flaw: the LLM invents the score. |
| 2 | Engine redesign | [`trust-engine-redesign.md`](trust-engine-redesign.md) | The principle (AI ≠ scorer), the two-number model, methodology, migration. |
| 3 | Evidence layer | [`evidence-collection-layer.md`](evidence-collection-layer.md) | Per-input-type validation, evidence sources, reputation sources. |
| 4 | Threat intel | [`threat-intelligence.md`](threat-intelligence.md) | GSB/VT/PhishTank/OpenPhish/URLHaus/Spamhaus/AbuseIPDB/WHOIS/age — cost, limits, accuracy, integration, tiers. |
| 5 | Trust engine | [`trust-engine-architecture.md`](trust-engine-architecture.md) | Full pipeline + **risk / confidence / reputation formulas**. |
| 6 | Scoring model | [`scoring-matrix.md`](scoring-matrix.md) | Every weight, category cap, and override. |
| 7 | Reputation DB | [`reputation-database.md`](reputation-database.md) | Schema, indexes, relationships, ER diagram, RLS + write-RPCs. |
| 8 | Extension | [`chrome-extension.md`](chrome-extension.md) | MV3 architecture, folder structure, permissions, security model. |
| 9 | Competition | [`competitive-analysis.md`](competitive-analysis.md) | Truecaller/GSB/Norton/Bitdefender/MS Defender + the gaps NS exploits. |
| 10 | Strategy | [`recommended-architecture.md`](recommended-architecture.md) | Build-first/delay, moat, accuracy, defensibility, investor story. |
| 11 | Build prompt | [`implementation-prompt.md`](implementation-prompt.md) | Paste-ready Claude Code prompt + Week 1–4 roadmap. |

---

## Reading order

- **New to the redesign?** 1 → 2 → 5 → 6 (problem → principle → pipeline → numbers).
- **Implementing?** Go straight to 11, with 3/4/5/6/7 open as the spec.
- **Pitching / strategy?** 9 → 10.

---

## The core change in one diagram

```
BEFORE (today):  input ──► LLM ──► {scamProbability, trustScore, riskLevel}   ❌ hallucinated, injectable
AFTER (v2):      input ──► Evidence + Threat Intel + Rules + Reputation ──► Risk Engine ──► R,T,C
                                                                                  └─► LLM ──► explanation only ✅
```

---

## Source of truth & traceability

- **Weights** live in [`scoring-matrix.md`](scoring-matrix.md) → loaded from versioned
  config (`engineVersion`), never hard-coded.
- **Every verdict** persists its `Signal[]` to `scan_signals`
  ([`reputation-database.md`](reputation-database.md)) so it can be fully reconstructed.
- **Ships behind `ENGINE_V2`** for A/B against today's scorer
  ([`trust-engine-redesign.md`](trust-engine-redesign.md) §6).
