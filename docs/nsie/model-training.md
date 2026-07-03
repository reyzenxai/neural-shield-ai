# NSIE — Model Training

> Training strategy, dataset requirements, evaluation protocol, and graduation thresholds.
> Pre-requisites: [`data-pipeline.md §5–6`](data-pipeline.md), [`feature-engineering.md`](feature-engineering.md).
> Architecture: [`ml-architecture.md`](ml-architecture.md).
> MLOps tooling: [`mlops.md`](mlops.md).

---

## 1. Training Trigger Conditions

ML model training is triggered by two conditions (either is sufficient):

### 1.1 Data threshold (first training run)

The first ML model trains when the verified label dataset accumulates:
- **≥ 5,000 verified scam labels** (true_positive) across all modalities
- **≥ 5,000 verified safe labels** (true_negative) across all modalities
- **≥ 500 verified labels per modality** (to ensure every head has training signal)
- Labels must span at least 60 calendar days (prevents a single scam campaign from dominating)

These thresholds are conservative by design. LightGBM can train with fewer examples, but the confidence calibration and cross-validation results need sufficient data to be meaningful.

### 1.2 Retraining schedule (ongoing)

Once the ML model is live:
- **Weekly retraining** if ≥ 1,000 new verified labels accumulated since last training
- **Triggered retraining** when a new scam campaign generates ≥ 200 verified positives within 7 days (novel attack type)
- **Scheduled retraining** every 4 weeks regardless of label count (prevents model drift)

See [`continuous-learning.md`](continuous-learning.md) for the feedback loop that generates labels.

---

## 2. Dataset Design

### 2.1 Label sources and quality hierarchy

| Source | Label | Quality | Used in |
|--------|-------|---------|---------|
| Analyst confirmed | `true_positive` / `true_negative` | Highest | Training + eval |
| Auto-labeled (hard override, conf ≥ 0.95) | `true_positive` | High | Training only |
| Community consensus (WS ≥ 8) | `true_positive` | Medium | Training (50% sample) |
| Community feedback (WS 2–8) | Weak positive | Low | Not used directly |

Evaluation set uses only analyst-confirmed labels to prevent community bias in metrics.

### 2.2 Class balance

Scam cases are rare in the real world (good). For training, random class imbalance causes the model to optimize for accuracy by predicting "safe" always. Target balance:

**Training set:** 40–60% scam (resample to achieve this if needed)
**Evaluation set:** reflects real-world class distribution (~5–15% scam), to get realistic precision/recall estimates

Resampling strategy: oversample minority class using SMOTE (Synthetic Minority Oversampling Technique) for tabular features; simple duplication for text embedding inputs.

### 2.3 Stratification

Training and validation splits are stratified by:
1. `scan_type` (modality) — ensures each head has both positive and negative examples
2. `scam_type_tag` (when available) — ensures diverse scam categories in both splits
3. `created_at` (time-based split preferred over random split) — train on older data, validate on newer data; this simulates real deployment conditions where the model is always trained on past data and evaluated on future data

**Time-based split:** use 80% oldest labeled scans for training, 20% most recent for validation. Never use future examples to predict past examples.

### 2.4 Feature engineering at training time

Run the same feature extraction code as production, but over the labeled scan rows. Key differences:
- TI collector results are read from the stored `scan_traces` (already collected at scan time), not re-queried
- For features that were not collected at scan time (introduced in a later feature engineering version), those features are null for historical rows — treated as missing (−1.0 in the feature vector)
- `engine_version` is included as a feature so the model can learn version-specific patterns

---

## 3. Model Training Procedure

### 3.1 Feature preprocessing

1. Load dataset from DVC-versioned parquet file
2. Compute per-feature statistics (mean, std, min, max) from training set only (never from validation or test)
3. Normalize: log1p for counts, min-max for floats, one-hot for categoricals
4. Handle missing values: fill with −1.0 (signals "not available" to the model)
5. Save normalization statistics to `feature_stats_v{N}.json` as a model artifact

### 3.2 LightGBM training

```python
import lightgbm as lgb

params = {
    "objective": "binary",
    "metric": ["binary_logloss", "auc"],
    "num_leaves": 256,
    "max_depth": 6,
    "learning_rate": 0.05,
    "min_child_samples": 50,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "reg_alpha": 0.1,
    "reg_lambda": 0.2,
    "class_weight": "balanced",  # handles residual class imbalance
    "verbose": -1,
}

# Per-modality head: filter dataset to modality, train separate booster
for modality in ["text", "url", "email", "phone", "upi", "screenshot", "qr"]:
    train_data = lgb.Dataset(
        X_train[train_modality_mask],
        label=y_train[train_modality_mask]
    )
    valid_data = lgb.Dataset(
        X_valid[valid_modality_mask],
        label=y_valid[valid_modality_mask]
    )
    model = lgb.train(
        params,
        train_data,
        num_boost_round=500,
        valid_sets=[valid_data],
        callbacks=[lgb.early_stopping(50), lgb.log_evaluation(50)],
    )
    model.save_model(f"models/head_{modality}_v{VERSION}.lgb")
```

**Note:** the shared backbone concept is approximated by including modality as a feature in a single joint model, then training separate models per modality for the head. True multi-task learning with a single tree ensemble is not directly supported by LightGBM; the "shared" representation emerges from the feature space rather than explicit parameter sharing.

### 3.3 Hyperparameter search

Use Optuna for hyperparameter optimization, with 50 trials per modality:

```python
import optuna

def objective(trial):
    params = {
        "num_leaves": trial.suggest_int("num_leaves", 64, 512),
        "max_depth": trial.suggest_int("max_depth", 3, 9),
        "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.3, log=True),
        "min_child_samples": trial.suggest_int("min_child_samples", 20, 200),
        "reg_alpha": trial.suggest_float("reg_alpha", 1e-4, 10, log=True),
    }
    # ... train and return validation AUC-PR
```

Optimize for **AUC-PR** (area under precision-recall curve), not AUC-ROC. AUC-PR is more informative for imbalanced datasets and better reflects the real-world cost structure (false positives cost user trust; false negatives cost safety).

---

## 4. Evaluation Protocol

### 4.1 Metrics

Primary metrics (reported for each modality and overall):

| Metric | Description | Target |
|--------|-------------|--------|
| **Precision@0.5** | TP / (TP + FP) at threshold 0.5 | > 0.90 |
| **Recall@0.5** | TP / (TP + FN) at threshold 0.5 | > 0.85 |
| **AUC-PR** | Area under precision-recall curve | > 0.92 |
| **FPR@95%recall** | False positive rate when recall = 95% | < 0.10 |

Secondary metrics:
- **Calibration error (ECE):** expected calibration error — measures how well `P(scam)` reflects actual scam rates in that probability bucket. Target: ECE < 0.05.
- **Temporal stability:** compare metrics on the first 30 days vs. last 30 days of validation data. A > 10% performance drop indicates the model is temporally unstable.

### 4.2 Graduation criteria

A new ML model is promoted to production only when all of the following hold:

1. Precision@0.5 ≥ 0.90 overall and ≥ 0.85 per modality
2. Recall@0.5 ≥ 0.85 overall
3. AUC-PR ≥ 0.92 overall
4. No modality has AUC-PR < 0.80
5. False positive rate < 5% on a held-out set of verified safe examples (high quality, analyst-confirmed)
6. Temporal stability: < 5% AUC-PR drop on most recent 30 days vs. overall validation
7. Shadow mode results (see [`ml-architecture.md §7`](ml-architecture.md)) show ML recall > rule engine recall without precision regression

### 4.3 Error analysis

Before promotion, run error analysis on:
- **False positives:** what safe content is the model flagging? Are they edge cases (ambiguous URLs) or systematic errors (e.g. all legitimate loan offers being flagged)?
- **False negatives:** what scam content is the model missing? Are these novel patterns that rules also miss, or patterns that should have been caught?
- **High-confidence errors:** any false positive with `P(scam) > 0.9` is a serious error — investigate each one manually

---

## 5. Confidence Calibration

LightGBM outputs uncalibrated probabilities. Post-hoc calibration using Platt scaling or isotonic regression on the validation set is applied before the model ships.

```python
from sklearn.calibration import CalibratedClassifierCV
# or isotonic regression directly:
from sklearn.isotonic import IsotonicRegression

# Fit calibrator on validation predictions
calibrator = IsotonicRegression(out_of_bounds='clip')
calibrator.fit(y_pred_val, y_val)

# Apply at inference time
p_calibrated = calibrator.predict(raw_lgbm_output)
```

Calibration is per-modality. The calibrator is saved alongside the LightGBM model as `calibrator_{modality}_v{N}.pkl` and included in the ONNX export pipeline.

---

## 6. Dataset Augmentation

For modalities with sparse labeled data:

**Text augmentation:**
- Synonym replacement for non-critical words (preserving scam-signal words)
- Random character substitutions simulating SMS abbreviations (u → you, 2 → to)
- Translation round-trip (English → Hindi → English) to create paraphrase variants

**URL augmentation:**
- Swap known scam TLDs for each other (.xyz ↔ .top)
- Perturb domain registration date by ±3 days
- Add/remove subdomain levels

**Caution:** augmentation is applied only to training data, never validation. Over-augmented datasets can produce unrealistically high training metrics.

---

## 7. Baseline Comparison

Before deploying any ML model, it must beat the deterministic rule engine baseline on the same evaluation set:

| Model | Precision@0.5 | Recall@0.5 | AUC-PR |
|-------|---------------|------------|--------|
| Rule engine (current) | TBD on first eval | TBD | TBD |
| ML baseline (LightGBM) | Must exceed rule engine | Must exceed | Must exceed |

The rule engine baseline is computed by treating the rule engine's `scamProbability` as a model output and evaluating it against verified labels using the same protocol. This establishes the performance floor — there is no reason to ship an ML model that is worse than the existing deterministic system.
