# NSIE — ML Architecture

> Roadmap for adding a machine learning scoring layer to NSIE.
> This document describes the target architecture; the current system is the deterministic
> trust engine (v2.1.4). ML graduation begins when the verified label dataset reaches
> the thresholds in [`model-training.md`](model-training.md).
> Features: [`feature-engineering.md`](feature-engineering.md).
> Deployment: [`model-deployment.md`](model-deployment.md).

---

## 1. Why ML, and Why Not Yet

The current NSIE trust engine is deliberately deterministic. Deterministic rules are auditable, debuggable, and don't require training data — which we don't yet have at scale. The weights in `config/weights.ts` are hand-tuned and versioned.

ML adds value when:
1. **Recall gaps appear:** rules miss sophisticated attacks that don't trigger specific patterns
2. **Training data is sufficient:** ≥ 10,000 verified, balanced scam/safe labels (see thresholds in [`model-training.md`](model-training.md))
3. **Rule maintenance becomes expensive:** when the scam landscape evolves faster than rules can be updated

ML does **not** replace the rule engine. It adds a parallel scoring path that produces an additional signal which the risk engine treats like any other source — with its own tier, weight, and category.

**Design invariant:** the deterministic pipeline (rules + TI + reputation) always runs. ML is an enhancement, not a replacement.

---

## 2. Target Architecture — Multi-Task Learning

### 2.1 Why multi-task

Each scan modality (text, URL, email, phone, UPI, screenshot, QR) shares common scam patterns — urgency language, brand impersonation, credential requests — but also has modality-specific features (domain age only applies to URLs; PSP validation only applies to UPI).

A shared backbone learns these common representations once. Seven specialized classification heads learn modality-specific patterns on top. This approach:
- Requires less per-modality training data (shared backbone compensates)
- Enables cross-modal knowledge transfer (patterns learned from phishing URLs inform detection of phishing URLs embedded in SMS)
- Keeps the model count at 1 (not 7 separate models to deploy and version)

### 2.2 Architecture diagram

```
                    Input (feature vector, modality-aware)
                           │
                    [Shared Backbone]
                    LightGBM gradient-boosted tree
                    trained on all modalities jointly
                    256 leaf trees, 6 max depth
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
    [Head: text]    [Head: url]      [Head: email]
    binary cls.     binary cls.      binary cls.
          ▼                ▼                ▼
    P(scam|text)    P(scam|url)      P(scam|email)
          │                │                │
          └────────────────┴────────────────┘
                           │
                    Modality head output
                    → normalized to [0, 1]
                    → converted to Signal(
                        id: "ml.score",
                        category: "content",
                        weight: 40 × score,
                        confidence: ml_calibration_score,
                        sourceTier: 2
                      )
                    → injected into NSIE signal pipeline
```

### 2.3 Why LightGBM, not a neural network

For tabular feature vectors (the feature engineering in this codebase produces structured numeric vectors, not raw text embeddings), LightGBM consistently outperforms deep networks:
- Trains 10–50× faster
- Handles missing features natively (no imputation needed)
- Produces ONNX models that run on any platform
- Is inherently interpretable via SHAP values
- Requires far less training data to converge

A Transformer over raw text will be added as a **separate embedding signal** (see §3.2), not as the primary classifier.

---

## 3. Model Components

### 3.1 Primary classifier — LightGBM multi-task

**Input:** feature vector assembled from [`feature-engineering.md`](feature-engineering.md) (~120 features depending on modality)

**Training objective:** binary cross-entropy per modality head, summed over modalities. Modality is a categorical input feature (one-hot) so the backbone learns modality-conditional representations.

**Output:** 7 `P(scam)` values, one per modality head. At inference, only the relevant head's output is used.

**Hyperparameters (initial):**
```
num_leaves: 256
max_depth: 6
learning_rate: 0.05
min_child_samples: 50
subsample: 0.8
colsample_bytree: 0.8
reg_alpha: 0.1
reg_lambda: 0.2
```

These will be tuned via 5-fold cross-validation on the first verified dataset. Optimal values depend heavily on dataset size and class balance.

### 3.2 Text embedding signal (optional, additive)

For text/message inputs, a lightweight text embedding can supplement the LightGBM features:

**Option A — TF-IDF + logistic regression:** fast, interpretable, works with small datasets. Vocabulary size ~50k tokens; character n-grams for robustness to SMS abbreviations.

**Option B — IndicBERT fine-tuned:** handles Hindi/Tamil/Bengali/English mixed text (critical for India). Requires ~50k labeled examples to fine-tune effectively. High quality but slow (~200ms inference).

**Option C — sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2:** multilingual, fast (20ms), 384-dimensional embeddings. Suitable for NSIE at moderate scale.

Start with Option A (TF-IDF) once the label dataset reaches 5k examples. Upgrade to Option C when the dataset reaches 20k. Option B is a Phase 3 investment (see [`future-roadmap.md`](future-roadmap.md)).

The text embedding produces a `P(scam)` score which becomes an additional feature fed into the LightGBM backbone.

### 3.3 Image classifier (screenshot modality)

A lightweight CNN (MobileNetV3-Small or EfficientNet-B0) classifies screenshots by visual layout before OCR. This catches:
- Fake bank login pages (even if the OCR text is clean)
- Fraudulent payment confirmation screens
- Fake "transaction successful" screenshots used as payment proof

**Input:** 224×224 image (center-crop and normalize)
**Output:** P(fake_payment_screenshot), P(phishing_login_page), P(legitimate)
**Model size target:** < 5 MB (runs on-device in mobile future)

Image classification runs alongside OCR text analysis; both outputs feed into the NSIE signal pipeline independently.

---

## 4. Cross-Modal Knowledge Transfer

The key advantage of the multi-task approach is that evidence from one modality can inform detection in another:

**Example 1:** A phone number that appears in a known-scam UPI handle increases that phone number's ML risk score directly, even if the phone has never been independently reported.

**Example 2:** Domain patterns learned from phishing URL training examples transfer to detecting phishing domains embedded in SMS text.

**Implementation:** these cross-modal signals are implemented as features:
- `entity_seen_in_other_modality`: bool — has this entity value appeared in a scan of a different type?
- `other_modality_max_risk`: float — maximum risk score from other-modality scans of the same underlying entity
- `co_occurrence_count`: int — how many scans contain both this entity and a recently flagged entity

These features are computed from the scan history at feature extraction time and fed into the backbone as additional inputs.

---

## 5. Explainability

All NSIE ML decisions must be explainable to users and auditable by the team.

### 5.1 SHAP values

LightGBM supports SHAP (SHapley Additive exPlanations) natively. At inference time, SHAP values identify which features contributed most to the ML risk score. The top-5 SHAP contributors are translated into human-readable signal labels and added to the `signals[]` array alongside rule engine signals.

Example ML signal generated from SHAP:
```
Signal {
  id: "ml.domain_age_new_tld_combo",
  label: "ML: domain registered recently with a suspicious TLD",
  weight: 28,
  confidence: 0.76,
  source: "ml_lgbm_v1",
  sourceTier: 2
}
```

### 5.2 Counterfactuals

For high-risk verdicts, NSIE generates a counterfactual: "If the domain were 2 years older, the risk would drop to medium." This requires perturbing the feature vector and re-running inference — cheap for LightGBM, acceptable latency impact.

---

## 6. Model Versioning and Compatibility

ML models are versioned independently from the rule engine:

```
ENGINE_VERSION = "trust-engine@2.1.4"   // rule engine version
ML_VERSION = "nsie-ml@1.0.0"            // ML model version
```

Both versions are stored in the `scans` table alongside every verdict. This allows:
- Retrospective analysis: if the ML model is replaced, past verdicts can be re-classified
- A/B testing: traffic can be split between model versions
- Rollback: if a new ML model degrades precision, the old model can be restored without any rule engine changes

---

## 7. Graduation Path from Rules to ML

The ML layer graduates through three phases:

**Phase 1 — Shadow mode** (ML model runs but doesn't affect scores)
- ML signal injected into the pipeline with `weight = 0`
- ML predictions logged alongside rule engine predictions
- Measure ML precision/recall vs. rule engine on verified labels
- Target: ML recall > rule engine recall (more true positives caught)

**Phase 2 — Supplementary mode** (ML adds signals, rules remain primary)
- ML signal activated with `weight = 20`, `sourceTier = 2`
- Hard overrides from rule engine and TI collectors take precedence
- Monitor for precision regressions (false positive rate)
- Target: no increase in false positive rate, measurable recall improvement

**Phase 3 — Full integration** (ML and rules co-equal, confidence-weighted)
- ML tier promoted to `sourceTier = 2` with `weight = 40`
- Category cap for ML signals: `ml` category, cap = 40
- Hard overrides from TI and reputation still override ML
- Target: confidence-weighted blend where high-confidence ML scores trump low-confidence rule-only verdicts

See [`continuous-learning.md`](continuous-learning.md) for the feedback loop that trains the ML model from production data.
