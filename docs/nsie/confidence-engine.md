# NSIE — Confidence Engine

> Module E of the Trust Engine. Source: `backend/src/engine/risk.ts` → `computeConfidence()`.
> Context: [`trust-engine-architecture.md §5`](../trust-engine-architecture.md).

---

## 1. Purpose

Confidence `C ∈ [0, 1]` is the engine's estimate of how well-evidenced the verdict is. It is **not** a second risk score — a high-risk, high-confidence verdict means "we are sure it's dangerous." A high-risk, low-confidence verdict means "the signals point toward danger but we have limited data."

Confidence feeds into:
- The verdict label shown to users ("Dangerous — confirmed" vs. "Likely dangerous — limited data")
- The `confidence` field stored in the `scans` table and returned in API responses
- Future ML retraining: only high-confidence scans with verified labels are used for supervised training

---

## 2. Inputs to Confidence

### 2.1 Coverage

```
coverage = (sources_queried - sources_failed) / sources_queried
```

`sources_queried` is the set of all TI sources that were applicable and attempted for this entity type. `sources_failed` is the subset that timed out or returned errors. Coverage measures how completely NSIE was able to gather evidence.

- A URL scan with all 11 collectors returning data: coverage ≈ 1.0
- A URL scan where VirusTotal and AbuseIPDB timed out: coverage ≈ 9/11 ≈ 0.82
- A text scan (no TI collectors apply): coverage = 0 / 0 → defaults to 0.5 (no collector attempted, no failure)
- A text scan with only reputation_db queried and it failed: coverage = 0/1 = 0

Coverage weight in the confidence formula: **0.45** (highest weight — having complete data is the primary driver of confidence).

### 2.2 Reliability

```
reliability = mean(TIER_MULTIPLIER[s.sourceTier]) over contributing signals
```

Where "contributing" means `effectiveWeight(s) ≠ 0` and `TIER_MULTIPLIER = {1: 1.0, 2: 0.7, 3: 0.5}`.

If all signals come from tier-1 sources (Google Safe Browsing, RDAP, Spamhaus), reliability = 1.0. If they come from regex rules (tier 3), reliability = 0.5.

- No contributing signals: reliability defaults to 0.5 (no evidence, no basis for reliability)

Reliability weight: **0.25**.

### 2.3 Agreement

```
f_pos = count of contributing signals with effective_weight > 0
f_neg = count of contributing signals with effective_weight < 0

agreement = |f_pos - f_neg| / (f_pos + f_neg)   ; defaults to 0.5 if both are 0
```

Agreement measures signal consensus. If all signals point the same direction (all risk-raising or all trust-boosting), agreement = 1.0. If half the signals raise risk and half lower it, agreement = 0.

A scan where GSB flags a URL as malware (risk-raising) but the domain is 6 years old (trust-boosting) will have lower agreement than a scan where everything points the same direction.

Agreement weight: **0.30**.

---

## 3. Formula

```
C = clamp(
  0.45 × coverage + 0.25 × reliability + 0.30 × agreement,
  0, 1
)
```

**Hard override exception:** if the `findOverride()` check detected a `malicious` hard override (tier-1 source, confidence ≥ 0.9), confidence is forced to at least `max(C, 0.95)`. A hard malicious override from a verified source (GSB, PhishTank) is definitionally high-confidence.

---

## 4. Verdict Label Qualification

The `verdictLabelFor(riskLevel, confidence)` function produces the user-visible verdict string. Confidence is bucketed into three tiers:

| Confidence tier | Threshold |
|----------------|-----------|
| High | C ≥ 0.66 |
| Medium | 0.40 ≤ C < 0.66 |
| Low | C < 0.40 |

Label matrix:

| Risk level | High confidence | Low confidence |
|------------|-----------------|----------------|
| `critical` | "Dangerous — confirmed" | "Likely dangerous — limited data" |
| `high` | "High risk" | "Suspicious — verify manually" |
| `medium` | "Some risk — be careful" | "Unverified — caution" |
| `low` | "Low risk" | "Low risk" |
| `safe` | "Looks safe" | "No red flags found, but limited data" |

---

## 5. Interpretation Examples

**Example 1 — URL with all TI sources, GSB hit:**
- Coverage: 1.0 (all 11 collectors responded)
- Reliability: ~0.85 (mix of tier-1 and tier-2 sources)
- Agreement: 1.0 (everything risk-raising; malicious override triggered)
- Confidence: forced to 0.95 by malicious override
- Verdict: "Dangerous — confirmed"

**Example 2 — Suspicious SMS, no URLs:**
- Coverage: 0.5 (only reputation_db applicable; it returned no reports)
- Reliability: 0.5 (all signals from tier-3 rules)
- Agreement: 1.0 (only content signals, all risk-raising)
- C = 0.45×0.5 + 0.25×0.5 + 0.30×1.0 = 0.225 + 0.125 + 0.30 = 0.65
- Risk band: medium (content cap fired multiple rules); verdict: "Some risk — be careful"

**Example 3 — Old domain, clean TI, no community reports:**
- Coverage: 1.0
- Reliability: 0.85
- Agreement: ~0.1 (trust signals dominate but slight content risk)
- C ≈ 0.45×1.0 + 0.25×0.85 + 0.30×0.1 = 0.45 + 0.21 + 0.03 = 0.69
- Risk band: safe; verdict: "Looks safe"

---

## 6. Calibration Notes

The three weights (0.45, 0.25, 0.30) were chosen by analyzing which factor most correlates with verdict correctness:

- **Coverage dominates** because having complete TI data is the primary determinant of whether a verdict is reliable. A scan with only 2 of 11 collectors responding is structurally less trustworthy.
- **Agreement is second** because signal consensus is a strong indicator of whether the evidence is coherent — contradictory signals often indicate ambiguous cases.
- **Reliability is third** because tier assignments already reflect source trustworthiness; it's already baked into effective weights.

These weights should be revisited after accumulating 10,000+ verified scan labels (see [`model-training.md`](model-training.md)). A logistic regression over verified labels → actual outcome will produce empirical calibration weights to replace the current hand-tuned values.

---

## 7. Known Limitations and Planned Improvements

**Current limitations:**
- Coverage treats all collector timeouts equally. A VirusTotal timeout loses more signal value than an OpenPhish timeout (their hit rates differ). Future: weighted coverage using historical hit-rate per source.
- The formula doesn't account for entity type. A text message with 0.65 confidence means something different from a URL scan with 0.65 confidence (text scans have fewer applicable sources by design).
- Agreement ignores signal weights. A single tier-1 source flagging as safe counts the same as 10 tier-3 rules flagging as risky.

**Planned improvements (NSIE v2.0):**
- Source-specific hit-rate weighting in the coverage term
- Entity-type-conditional confidence normalization
- ML-calibrated weights using isotonic regression over verified outcome data (see [`continuous-learning.md`](continuous-learning.md))
