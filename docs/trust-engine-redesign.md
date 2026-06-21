# Trust Score & Scam Probability — Engine Redesign

> **Task 2 deliverable.** Replaces the current LLM-generated score
> (`backend/src/services/ai.service.ts`) with a deterministic, evidence-based
> engine. The companion docs are [`trust-engine-architecture.md`](trust-engine-architecture.md)
> (Task 5, full pipeline + formulas) and [`scoring-matrix.md`](scoring-matrix.md)
> (Task 6, every weight).

---

## 1. The non-negotiable principle

> **The AI does not generate scores. Ever.**

| AI **MUST** do | AI **MUST NOT** do |
|---|---|
| Explain findings in plain language | Produce `scamProbability` |
| Summarize the evidence the engine collected | Produce `trustScore` |
| Generate the user recommendation | Produce `riskLevel` |
| Classify scam *type* (label only, advisory) | Decide the verdict |
| Translate/normalize messy input for the collectors | Override any rule or source |

The number comes **only** from:

```
Evidence Collection  +  Threat Intelligence  +  Rule Engine  +  Reputation Engine
```

This makes every verdict **deterministic, reproducible, auditable, and injection-resistant.**
An attacker controlling the input text can no longer control the score, because the
score is computed from external sources (blocklists, WHOIS, DNS, report history),
not from how persuasive the text reads.

---

## 2. Why deterministic-first wins

| Property | LLM-as-scorer (today) | Evidence engine (v2) |
|---|---|---|
| Reproducible | ❌ varies by model/run | ✅ same input+sources → same score |
| Auditable | ❌ "the model said 0.83" | ✅ full evidence + rule trace stored |
| Injection-safe | ❌ text owns the score | ✅ sources own the score |
| Calibratable | ❌ no ground truth | ✅ tune weights against labeled outcomes |
| Improves over time | ❌ static | ✅ reputation + feedback loop |
| Explainable to a user | ⚠️ prose only | ✅ "domain is 4 days old · on PhishTank · 12 reports" |
| Cost | 💸 LLM call per scan | ✅ cache + cheap lookups; LLM only for prose |

---

## 3. Two numbers, one source of truth

The product surfaces **Scam Probability** and **Trust Score**. In v2 both derive
from a single internal **Risk Score `R ∈ [0,100]`** plus a **Confidence `C ∈ [0,1]`**.
Keeping one source of truth removes the F-FE-1 inconsistency (demo vs backend) and
the contradiction risk of two independent numbers.

```
                    ┌──────────── Risk Engine ───────────┐
 Evidence + TI + Reputation ──► Rule Engine ──► R (0-100), C (0-1)
                    └─────────────────────────────────────┘
                                   │
            ┌──────────────────────┼───────────────────────┐
            ▼                      ▼                        ▼
   Scam Probability        Trust Score              Verdict / Risk Level
     P = f(R)              T = 100 − R              g(R, C)  →  band + label
```

### 3.1 Scam Probability

For v1 (before we have enough labeled feedback to calibrate a logistic curve):

```
P = R / 100            # 0.00 – 1.00, monotonic in risk
```

For v2 (once the `feedback` table has ground-truth labels — see
[`reputation-database.md`](reputation-database.md)), replace the linear map with a
**Platt-style logistic calibration** so `P` is a *real* probability that matches
observed scam rates:

```
P = 1 / (1 + e^(−(a·R + b)))
```

where `a, b` are fit by logistic regression of `R` against confirmed scam/clean
labels. This is what makes "0.83" mean "≈83% of inputs scoring this way were
scams," instead of a decoration.

### 3.2 Trust Score

```
T = clamp(100 − R, 0, 100)
```

Trust Score is the safe-facing inverse of risk. We deliberately keep it a strict
function of `R` so the two numbers can never contradict (you cannot have high scam
probability *and* high trust). Positive reputation (verified org, trusted domain)
already lowers `R` via negative-weight signals — see [`scoring-matrix.md`](scoring-matrix.md) §4.

### 3.3 Confidence (reported separately, never folded into the score)

`C` answers *"how much do we trust this verdict?"* — driven by how much evidence we
actually gathered and whether sources agree. **We never blend `C` into `P`** (that
would hide information). Instead the **verdict label** uses both axes:

| Risk band | High confidence (C ≥ 0.66) | Low confidence (C < 0.4) |
|---|---|---|
| R ≥ 80 | "Dangerous — confirmed" | "Likely dangerous — limited data" |
| 50–79 | "High risk" | "Suspicious — verify manually" |
| 20–49 | "Some risk" | "Unverified — caution" |
| < 20 | "Looks safe" | "No red flags found, but limited data" |

Full confidence formula is in [`trust-engine-architecture.md`](trust-engine-architecture.md) §5.

---

## 4. Scoring methodology

### 4.1 Signals, weights, provenance

Every contribution to `R` is a **signal**: a typed fact emitted by a collector,
threat-intel source, rule, or the reputation engine. A signal carries:

```ts
interface Signal {
  id: string;            // e.g. "ti.gsb.malware", "domain.age_lt_30d", "rule.credential_request"
  category: SignalCategory; // reputation | blocklist | domain_age | infra | content | identity | community
  weight: number;        // signed: + raises risk, − lowers risk  (the scoring-matrix value)
  confidence: number;    // 0–1, this signal's own certainty
  source: SourceId;      // who emitted it (gsb, virustotal, phishtank, whois, rule_engine, reputation_db…)
  sourceTier: 1 | 2 | 3; // source reliability tier (see TI doc) → reliability multiplier
  evidence: object;      // raw proof, persisted for audit ("domain created 2026-06-04", "vt 7/89 engines")
}
```

This `Signal[]` array **is** the audit trail. It is persisted with the scan
(see [`reputation-database.md`](reputation-database.md) `scan_signals`), so any
verdict can be fully reconstructed and explained — fixing F-DB-2.

### 4.2 Combining signals into R

A naive sum overflows and lets "many weak flags" out-vote "one confirmed hit." The
methodology uses three layers (full math in
[`trust-engine-architecture.md`](trust-engine-architecture.md) §3):

1. **Hard overrides (deterministic verdicts).** Certain signals bypass arithmetic:
   - *Malicious override*: e.g. on Google Safe Browsing malware/social-engineering
     list, or an exact verified PhishTank match → `R = 100`, `riskLevel = critical`.
   - *Allowlist override*: verified org / curated trusted domain with **no** malicious
     override present → `R = min(R, 10)`.
   - Malicious override always beats allowlist (a compromised trusted site is still dangerous).

2. **Weighted accumulation with category caps** (the normal path). Each signal's
   effective weight is `weight × confidence × reliability(sourceTier)`. Positive
   contributions are summed *per category* and capped, so e.g. five "urgency-ish"
   content flags can't exceed the content-category ceiling. This prevents
   keyword-stuffing from dominating.

3. **Calibrated mapping** to `P`, `T`, and the verdict band as in §3.

### 4.3 The role of the LLM in this methodology

The LLM runs **after** `R`, `T`, `C`, and the signal list are final. It receives the
*structured evidence* and writes:
- `summary` — 2–3 sentences explaining what the evidence means.
- `recommendation` — the action for the user.
- `scamTypeLabel` — advisory classification (does **not** change `R`).

It is explicitly told the numbers are already decided and that it must not contradict
them. Its output is cosmetic narration over a decided verdict — see the prompt
contract in [`trust-engine-architecture.md`](trust-engine-architecture.md) §6.

---

## 5. New result contract

Extends today's `ScanResult` (`backend/src/types/index.ts`) — additive, so the
frontend keeps working while gaining provenance:

```ts
interface ScanResultV2 {
  // ── decided by the engine (NOT the AI) ──
  scamProbability: number;     // 0.0–1.0  = P
  trustScore: number;          // 0–100    = T
  riskScore: number;           // 0–100    = R   (new, internal/debug + advanced UI)
  riskLevel: RiskLevel;        // verdict band
  confidence: number;          // 0–1      = C   (new)
  verdictLabel: string;        // e.g. "High risk — verify manually" (new)
  signals: Signal[];           // full evidence trail (new) — drives the "why" UI
  decisionTrace: {             // (new) which override/rules fired, for audit
    override: "malicious" | "allowlist" | null;
    firedRuleIds: string[];
    sourcesQueried: SourceId[];
    sourcesFailed: SourceId[];
  };

  // ── written by the AI (explanation only) ──
  summary: string;             // (was detailedAnalysis)
  recommendation: string;
  scamType: string | null;     // advisory label only

  // ── metadata ──
  aiModel: string;             // model used for the *explanation*
  engineVersion: string;       // e.g. "trust-engine@2.0.0" — reproducibility
  processingTimeMs: number;
  cached: boolean;             // served from reputation cache?
}
```

---

## 6. Migration path (no big-bang rewrite)

The redesign ships behind a flag so detection quality can be A/B'd against today's
LLM scorer:

1. **Phase A — shadow.** Build the engine; run it alongside the LLM scorer; log both
   `R` and the LLM number to `scans` + `scan_signals`. Serve the LLM number to users.
   Collect divergence data.
2. **Phase B — engine-primary, LLM-explainer.** Flip `ENGINE_V2=true`. Engine
   decides; LLM only explains. Keep LLM-score logging for regression.
3. **Phase C — calibrate.** Once `feedback` has labels, fit the logistic map (§3.1)
   and retune weights from [`scoring-matrix.md`](scoring-matrix.md).
4. **Phase D — retire LLM scoring path** entirely.

This maps directly onto the Week-1→4 roadmap in
[`implementation-prompt.md`](implementation-prompt.md).

---

*Next:* [`evidence-collection-layer.md`](evidence-collection-layer.md) (Task 3) —
how each input type is turned into evidence the engine can score.
