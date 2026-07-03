# NSIE — Continuous Learning

> How NSIE improves over time without manual intervention.
> Related: [`data-pipeline.md §5`](data-pipeline.md), [`model-training.md`](model-training.md),
> [`reputation-graph.md §2`](reputation-graph.md), [`mlops.md`](mlops.md).

---

## 1. What "Continuous Learning" Means for NSIE

Continuous learning in NSIE operates at three distinct speeds:

| Speed | Mechanism | Latency | Requires retraining? |
|-------|-----------|---------|---------------------|
| Real-time | Reputation engine score update | Seconds | No |
| Near-real-time | TI cache refresh | 1–4 hours | No |
| Batch | ML model retraining | Weekly | Yes |

The reputation engine and TI cache provide the fast adaptation layer. The ML model captures systematic patterns that emerge after sufficient verified data accumulates. Rule engine changes (adding new patterns) are manual but can be deployed immediately without retraining.

---

## 2. Feedback Loop Architecture

```
User scans content
        │
        ▼
NSIE verdict returned
        │
        ├──► [Implicit feedback] Verdict stored in scans table
        │                         ↓
        │                   App behavior (did user click the link anyway?)
        │                   (Future signal — requires mobile event tracking)
        │
        └──► [Explicit feedback] User taps "Report inaccurate result"
                        │
                        ▼
              scan_reports table updated
                        │
                        ▼
              app_get_reputation RPC aggregates
                        │
                        ▼
              weighted_report_score updated
                        │
                        ▼
              Next scan of same entity → new reputation signal
                        │                (same-day effect)
                        ▼
              If WS ≥ threshold → auto-labeled as true_positive
                        │
                        ▼
              Weekly ETL → ML training dataset updated
                        │
                        ▼
              ML model retrain → new weights deployed
```

---

## 3. Reputation Engine as Fast Learner

The reputation engine is the primary mechanism for real-time adaptation. It does not require ML inference or model deployment.

### 3.1 Signal propagation time

When a scam phone number is first reported by one user:
- WS = ~0.7 (single low-weight report) → fires `reputation.prior_scam_verdict` (weight 30)
- Next scan of that number: risk score increases by 30 × 0.5 × 0.7 = 10.5 points

When the same number accumulates 5 independent reports:
- WS ≈ 2.5 → fires `reputation.community_abuse` (weight 50)
- Next scan: risk score increases by 50 × 0.7 × 0.7 = 24.5 points

When 15+ verified reports accumulate (WS ≥ 8):
- `reputation.community_override` → hard malicious override → riskScore = 100

This means a scam phone number that first appears today can be definitively flagged as `critical` within hours if the user community reports it consistently.

### 3.2 Temporal decay

The reputation system applies time decay to prevent stale community signals from permanently blacklisting entities:

- Reports older than 30 days: half-weighted in WS computation
- Reports older than 90 days: quarter-weighted
- If the entity has not been scanned or reported in 6 months and recent scans are returning safe results, the `clean_history` signal can begin to fire again

This models the reality that a phone number or domain may change ownership and become legitimate.

---

## 4. ML Model Adaptation

### 4.1 Retraining pipeline

Triggered by the conditions in [`model-training.md §1`](model-training.md). The pipeline:

1. ETL exports new verified labels from `scan_labels` (see [`data-pipeline.md §7`](data-pipeline.md))
2. Feature extraction runs over the new labeled examples
3. Dataset is appended to the existing DVC-tracked training set (no full rebuild unless feature schema changed)
4. Model trains on the full updated dataset
5. Evaluation against held-out validation set
6. If graduation criteria pass: model promoted to staging
7. Shadow mode comparison (new model vs. current model on live traffic)
8. If shadow metrics pass: rollout begins (1% → 10% → 50% → 100%)

### 4.2 Incremental vs. full retraining

**Incremental (preferred for weekly runs):** train on the last 30 days of labeled data with a learning rate warm-up. Start from the previous model's weights rather than random initialization. Faster, but risks overfitting to recent data.

**Full retraining (required for):**
- Feature engineering schema changes
- Model architecture changes
- Quarterly refresh to incorporate long-tail historical data
- After a detection miss on a major scam campaign (re-trains with campaign examples)

### 4.3 Concept drift detection

Scam tactics evolve. A model trained on last quarter's data may underperform on this quarter's novel scam types.

Monitor for concept drift using:
- **Population Stability Index (PSI):** compares the feature distribution of recent scans vs. training-time distribution. PSI > 0.2 on any key feature triggers a drift alert.
- **Performance monitoring:** track rolling 7-day precision/recall on analyst-labeled scans. A > 8% drop from the training-time metrics triggers an alert.
- **Scam type distribution shift:** if a new `scam_type_tag` category appears in analyst labels that wasn't in the training set, trigger an immediate targeted retraining.

---

## 5. Rule Engine Updates as Learning

Manual rule engine updates are a form of supervised learning with zero data requirements. When an analyst identifies a new scam pattern:

1. Pattern is codified as a regex in `rules.ts`
2. Signal ID and weight added to `WEIGHTS` in `config/weights.ts`
3. `ENGINE_VERSION` bumped
4. Deployed immediately (no training, no model approval process)
5. Historical scans are NOT retroactively re-scored; the new rule applies to new scans only

Rule engine updates have zero latency from identification to deployment. They are appropriate for well-defined, deterministic patterns. ML is appropriate for subtle, statistical patterns that defy explicit codification.

---

## 6. Online Learning (Future)

Online learning — updating model weights in real time from each new scan — is architecturally desirable but currently not implemented. The barriers:

**Why it's hard:**
- Online learning requires labeled data in real time. Community feedback is sparse and delayed.
- LightGBM doesn't support true online learning natively; requires incremental tree addition or a different algorithm.
- Online learning can introduce catastrophic forgetting — the model forgets old patterns as it adapts to new ones.

**When to implement:**
Phase 3 of the ML roadmap (see [`future-roadmap.md §3`](future-roadmap.md)). Prerequisites:
- Robust automated labeling pipeline (not dependent on community reports)
- Experience curve on safe batch retraining (catch failure modes first)
- River or Vowpal Wabbit integration for incremental tree models

**Interim approach (Phase 2):** run weekly batch retraining but with exponentially decaying sample weights — recent scans contribute more than old ones. This approximates online learning behavior without the infrastructure complexity.

---

## 7. Cross-Modality Knowledge Transfer in Continuous Learning

Each time the ML model is retrained, patterns learned from high-volume modalities (URL, text) propagate to low-volume modalities (QR, screenshot) through the shared feature space.

Concrete example: a phishing campaign uses a URL embedded in both SMS messages and QR codes. The URL modality accumulates verified labels quickly (more URL scans than QR scans). The QR modality benefits because:
1. The URL features (domain age, TLD, TI hits) are shared features across modalities
2. The entity value appears in the reputation table under both entity types
3. The ML model's URL head predictions are a feature in the QR head's input (via `other_modality_max_risk`)

This means a novel attack delivered via QR code can benefit from URL-modality learning within the same training cycle.

---

## 8. Human-in-the-Loop Requirements

Continuous learning is not fully autonomous. Human involvement is required for:

| Decision | Who | Frequency |
|----------|-----|-----------|
| Promoting model from staging to production | ML lead | Per training cycle |
| Approving rule engine changes | Security analyst | As needed |
| Auditing auto-labeled scans (high-confidence auto-labels) | Analyst (sample) | Weekly, 5% sample |
| Investigating concept drift alerts | ML lead | On alert |
| Reviewing analyst label disagreements | Security lead | Weekly |

The continuous learning system is designed to reduce the volume of human decisions, not eliminate them. All decisions that affect production scoring require human sign-off.
