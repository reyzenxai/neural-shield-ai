# NSIE — Threat Fusion

> How NSIE combines signals from all sources into a single verdict.
> Source: `backend/src/engine/risk.ts` → `computeRisk()` + `accumulate()`.
> Signal taxonomy: [`nsie-overview.md §3`](nsie-overview.md).
> Category caps and weights: `backend/src/engine/config/weights.ts`.

---

## 1. What Threat Fusion Does

Threat fusion is the process of combining signals from four independent sources:

1. **Rule engine** — deterministic pattern matches (content, identity, UPI, phone)
2. **Threat intelligence collectors** — 11 external sources (GSB, VirusTotal, Spamhaus, etc.)
3. **Structural analysis** — URL/domain heuristics (infra signals)
4. **Reputation engine** — community reports + historical scan data

Each source produces `Signal[]` objects. The risk engine fuses them into a single `riskScore` through three sequential layers:
1. Hard override check
2. Category-capped weighted accumulation
3. Score calibration to probability and trust score

---

## 2. Layer 1 — Hard Overrides

Hard overrides short-circuit the accumulation entirely. They apply only when the evidence quality is unambiguous.

### 2.1 Malicious override (R = 100)

Condition: at least one signal with:
- `override = "malicious"` (defined in the weight matrix)
- `sourceTier = 1` (tier-1 source only — the highest reliability)
- `confidence ≥ 0.9`

When triggered: `riskScore = 100`, `riskLevel = "critical"`, accumulation skipped.

Sources that can trigger a malicious override:
- `ti.gsb.malware` (Google Safe Browsing malware)
- `ti.gsb.social_engineering` (GSB phishing)
- `ti.phishtank.verified` (PhishTank verified phish)
- `ti.urlhaus.malware` (URLHaus malware host)
- `ti.openphish.match` (OpenPhish active phish)
- `reputation.community_override` (multiple verified community reports)

### 2.2 Allowlist override (R ≤ 10)

Condition: at least one signal with `override = "allowlist"`, and no malicious override present.

When triggered: normal accumulation runs in Layer 2, then the result is clamped to `min(R, 10)`. The scan can still report a small residual risk from content signals (e.g. a trusted domain that has a suspicious URL path) but cannot reach medium or high bands.

Sources that can trigger an allowlist override:
- `identity.verified_org` (verified organization in own allowlist)
- `reputation.trusted_domain` (curated trusted domain)

---

## 3. Layer 2 — Category-Capped Weighted Accumulation

### 3.1 Effective weight per signal

```
w_eff(s) = s.weight × s.confidence × TIER_MULTIPLIER[s.sourceTier]
```

Where `TIER_MULTIPLIER = { 1: 1.0, 2: 0.7, 3: 0.5 }`.

### 3.2 Category caps

Risk-raising signals (w_eff > 0) are accumulated within each category before being summed. Each category has a cap that prevents a single category from dominating the score through signal stacking.

| Category | Cap | Primary sources |
|----------|-----|-----------------|
| `blocklist` | 60 | TI collectors (GSB, VT, Spamhaus, etc.) |
| `reputation` | 50 | Community reports, prior verdicts |
| `content` | 35 | Rule engine content/linguistic rules |
| `pay` | 35 | UPI/payment rules |
| `infra` | 30 | Structural URL analysis |
| `identity` | 30 | Brand impersonation, sender mismatch |
| `domain_age` | 30 | RDAP registration date, DNS TTL |

### 3.3 Negative signals (trust-boosting)

Signals with `w_eff < 0` are accumulated without per-category caps and subtracted from the positive total. Trust signals are uncapped because they represent genuine evidence that something is safe, and stacking them should move the score lower proportionally.

Negative signals currently in the matrix:
- `identity.verified_org`: −40 (allowlist trigger)
- `reputation.trusted_domain`: −30 (allowlist trigger)
- `domain.age_gt_5y`: −20
- `domain.age_gt_2y`: −10
- `identity.spf_dkim_dmarc_pass`: −12
- `reputation.clean_history`: −15

### 3.4 Accumulation formula

```
R_accumulated = clamp(
  sum_over_categories( min(category_pos_total, CATEGORY_CAPS[cat]) ) + neg_total,
  0, 100
)
```

---

## 4. Layer 3 — Score Calibration

After accumulation (or override):

```
scamProbability = riskScore / 100
trustScore = clamp(100 - riskScore, 0, 100)
riskLevel = bandFor(riskScore)   // safe / low / medium / high / critical
```

The `bandFor()` thresholds:

| Band | R | Meaning |
|------|---|---------|
| `safe` | < 5 | No meaningful risk signals |
| `low` | 5–19 | Minor structural concerns |
| `medium` | 20–49 | Multiple risk factors — caution warranted |
| `high` | 50–79 | Strong evidence of threat |
| `critical` | ≥ 80 | Confirmed or near-certain scam/malware |

---

## 5. Worked Example — Phishing URL

Input: `hdfcbank-kyc-update.xyz/login`

Signals generated:

| Signal | Source | Weight | Conf | Tier | w_eff |
|--------|--------|--------|------|------|-------|
| `infra.suspicious_tld` (.xyz) | structural | 14 | 0.95 | 3 | 6.65 |
| `infra.brand_in_subdomain` (hdfc) | structural | 20 | 0.90 | 3 | 9.00 |
| `content.kyc_request` | rules | 26 | 0.85 | 3 | 11.05 |
| `identity.brand_impersonation` | rules | 14 | 0.70 | 3 | 4.90 |
| `domain.age_lt_7d` | RDAP | 30 | 1.00 | 1 | 30.00 |
| `ti.gsb.social_engineering` | GSB | 100 | 1.00 | 1 | 100.00 → override |

Hard override fires from GSB → `riskScore = 100`, `confidence ≥ 0.95`, `riskLevel = "critical"`.

---

## 6. Worked Example — Suspicious SMS (no URL)

Input: "Dear customer, your SBI account will be blocked. Call 9000123456 immediately."

Signals:

| Signal | w_eff | Category |
|--------|-------|----------|
| `content.urgency_threat` (blocked, immediately) | 16 × 0.8 × 0.5 = 6.4 | content |
| `identity.brand_impersonation` (SBI) | 14 × 0.7 × 0.5 = 4.9 | identity |
| `phone.premium_rate_prefix` (9000x) | 35 × 1.0 × 1.0 = 35.0 | content |

Category totals (before caps):
- content: 6.4 + 35.0 = 41.4 → capped at 35
- identity: 4.9 → under 30 cap → 4.9

R_accumulated = 35 + 4.9 = 39.9 → riskLevel = "medium"

Coverage: only reputation_db queried (no URLs) → coverage = 0.5
Confidence ≈ 0.49 → verdict: "Unverified — caution"

---

## 7. Sub-Entity Fusion

When text/email inputs contain embedded URLs or UPI IDs, those sub-entities go through their own full pipeline. Their signals come back tagged `fromSubEntity = true` and are merged into the same `signals[]` array before risk computation.

Sub-entity signals are not treated differently by the risk engine — they participate in category caps and accumulation the same as primary signals. The `fromSubEntity` tag is used only by the AI explanation layer to attribute which signals came from embedded links vs. the primary content.

---

## 8. Decision Trace

Every scan produces a `DecisionTrace` stored alongside the verdict:

```typescript
interface DecisionTrace {
  override: "malicious" | "allowlist" | null;
  firedRuleIds: string[];          // IDs of all signals that fired
  sourcesQueried: SourceId[];      // All sources attempted
  sourcesFailed: SourceId[];       // Sources that errored or timed out
}
```

This trace is the audit trail. It makes every verdict reproducible and debuggable: given the same input and the same `ENGINE_VERSION`, the same signals should fire and produce the same score.

---

## 9. Fusion vs. Future ML Scoring

The current fusion model is fully deterministic. The planned NSIE v3 ML layer (see [`ml-architecture.md`](ml-architecture.md)) does **not** replace fusion — it adds a parallel scoring path whose output is blended in as one additional "source" in the accumulation, with its own tier and category assignment.

The deterministic rule + TI layer remains the primary scorer. ML adds recall for subtle attacks that rules don't cover (sophisticated phishing, novel scam types) without sacrificing the auditability and override guarantees of the deterministic path.
