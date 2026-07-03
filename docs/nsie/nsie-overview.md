# Neural Shield Intelligence Engine (NSIE) — Overview

> **Index doc.** Start here. All other NSIE docs are linked from this one.
> Cross-references existing engine docs: [`trust-engine-architecture.md`](../trust-engine-architecture.md),
> [`scoring-matrix.md`](../scoring-matrix.md), [`threat-intelligence.md`](../threat-intelligence.md).

---

## 1. What NSIE Is

The Neural Shield Intelligence Engine is the detection core of Neural Shield AI. It takes any piece of digital content — a text message, a URL, an email, a UPI ID, a phone number, a screenshot, or a QR code — and returns a structured verdict: `scamProbability`, `trustScore`, `riskLevel`, `confidence`, a human-readable explanation, and the signal trail that produced the numbers.

NSIE is **not** a single model. It is a layered pipeline of deterministic rules, network threat intelligence collectors, a community reputation graph, a risk engine with verifiable math, and a language model that narrates — but never decides.

**Design axiom:** numbers come from deterministic, auditable logic. The LLM is the communicator, not the judge.

---

## 2. Current Architecture (trust-engine@2.1.4)

```
Input
  │
  ▼
[1] Normalize & classify
    entityFromScan() → Entity (url | domain | email | phone | upi | text)
  │
  ▼
[2] Rule Engine                   ← synchronous, <1 ms, zero network
    runRules() / runUpiRules() / runPhoneRules()
    10 content rules + brand/identity + UPI PSP + phone prefix checks
  │
  ├── (for url/domain/email) ──►  [3] URL/Domain Pipeline
  │                                    expandUrl() → redirect chain
  │                                    collectStructural() → infra signals
  │                                    runCollectors() → 11 TI sources in parallel
  │                                        RDAP · TLS · GSB · URLHaus · PhishTank
  │                                        OpenPhish · VirusTotal · Spamhaus DBL/ZEN
  │                                        AbuseIPDB · DNS TTL/sinkhole · SPF/DMARC
  │
  ▼
[4] Reputation Engine             ← community reports from Supabase RPC
    reputationSignals() → weighted_report_score → Signal
  │
  ▼
[5] Risk Engine                   ← the only place numbers are produced
    computeRisk(signals, coverage)
    → override check → category-capped accumulation → calibration
    → scamProbability · trustScore · riskLevel · confidence
  │
  ▼
[6] AI Explanation                ← Claude via OpenRouter (explanation only)
    aiService.explain(verdict + signals) → summary · recommendation · scamType
  │
  ▼
ScanResultV2
  scamProbability · trustScore · riskLevel · confidence
  signals[] · flags[] · summary · recommendation · scamType
  engineVersion · processingTimeMs · decisionTrace
```

---

## 3. Signal Taxonomy

Every piece of evidence is a typed `Signal`:

| Field | Type | Meaning |
|-------|------|---------|
| `id` | string | Stable key, e.g. `content.credential_request` |
| `category` | enum | `blocklist` · `domain_age` · `infra` · `content` · `identity` · `reputation` · `pay` |
| `weight` | number | Signed base weight: positive = risk-raising, negative = trust-boosting |
| `confidence` | 0–1 | Signal's own evidence quality |
| `sourceTier` | 1·2·3 | Reliability multiplier (1.0 · 0.7 · 0.5) |
| `override` | optional | `malicious` → R=100; `allowlist` → R≤10 |
| `evidence` | object | Raw proof (domain, handle, matched pattern) |
| `fromSubEntity` | bool | True if from an embedded link/entity, not the primary input |

**Effective weight:** `w_eff = weight × confidence × TIER_MULTIPLIER[sourceTier]`

---

## 4. Risk Bands

| Band | R threshold | Trust score |
|------|-------------|-------------|
| `safe` | < 5 | > 95 |
| `low` | 5–19 | 81–95 |
| `medium` | 20–49 | 51–80 |
| `high` | 50–79 | 21–50 |
| `critical` | ≥ 80 | 0–20 |

See [`trust-engine-architecture.md §7`](../trust-engine-architecture.md) for the full formula.

---

## 5. NSIE Scope and Coverage

**Scan modalities supported today:**

| Type | Rule engine | TI collectors | Reputation | AI explain |
|------|-------------|---------------|------------|------------|
| text/message | ✓ | — | ✓ | ✓ |
| url | ✓ | ✓ (all 11) | ✓ | ✓ |
| domain | ✓ | ✓ (all 11) | ✓ | ✓ |
| email | ✓ | ✓ (sender domain) | ✓ | ✓ |
| phone | ✓ | — | ✓ | ✓ |
| upi | ✓ | — | ✓ | ✓ |
| screenshot | OCR→text | ✓ (embedded URLs) | ✓ | ✓ |
| qr | decode→url | ✓ (all 11) | ✓ | ✓ |

**Sub-entity extraction:** for text/email inputs, embedded URLs (max 3), UPI IDs, and phone numbers are extracted and independently scanned. Their signals are tagged `fromSubEntity = true` and merged into the parent verdict.

---

## 6. Key Design Constraints

1. **Every collector fails open.** A timeout or API error lowers `confidence` but never crashes the scan. The orchestrator tracks `queried` and `failed` source sets; `coverage = (queried - failed) / queried` feeds into confidence.

2. **AI never scores.** Claude receives the already-decided verdict + signal labels. It returns a plain-language summary, a recommendation, and a scam-type label. It cannot change `scamProbability` or `riskLevel`.

3. **Weights are data, not code.** All signal weights live in `engine/config/weights.ts` as a versioned matrix. Tuning never touches rule logic — only the matrix. `ENGINE_VERSION` is bumped on every weight change so past verdicts are reproducible.

4. **Category caps prevent flooding.** No single category can contribute more than its cap to the raw risk score (e.g. `content` cap = 35, `reputation` cap = 50). This prevents a message with 10 keyword matches from reaching `critical` on content alone.

5. **Hard overrides are tier-1 only.** A malicious override (R=100) requires `sourceTier=1` AND `confidence ≥ 0.9`. This prevents a low-quality source from forcing a `critical` verdict.

---

## 7. Document Map

| Document | What it covers |
|----------|---------------|
| [`rule-engine.md`](rule-engine.md) | All deterministic rules, signal IDs, extension patterns |
| [`threat-fusion.md`](threat-fusion.md) | How signals from all sources are weighted and merged |
| [`confidence-engine.md`](confidence-engine.md) | Confidence formula, coverage computation, calibration |
| [`reputation-graph.md`](reputation-graph.md) | Community reputation system, score propagation |
| [`feature-engineering.md`](feature-engineering.md) | Feature extraction for all 7 modalities |
| [`ml-architecture.md`](ml-architecture.md) | Multi-task learning roadmap for NSIE v3+ |
| [`data-pipeline.md`](data-pipeline.md) | Scan ingestion → storage → labeling pipeline |
| [`model-training.md`](model-training.md) | Training strategy, dataset design, evaluation |
| [`continuous-learning.md`](continuous-learning.md) | Feedback loops, online learning, retraining triggers |
| [`mlops.md`](mlops.md) | MLflow, DVC, Feast, model lifecycle management |
| [`model-deployment.md`](model-deployment.md) | ONNX serving, versioning, rollback strategy |
| [`model-security.md`](model-security.md) | Adversarial robustness, data poisoning defense |
| [`future-roadmap.md`](future-roadmap.md) | 5-year NSIE evolution: modalities, languages, ML graduation |
