# NSIE — MLOps

> Tooling, infrastructure, and processes for managing NSIE model lifecycle.
> Related: [`model-training.md`](model-training.md), [`model-deployment.md`](model-deployment.md),
> [`continuous-learning.md`](continuous-learning.md).

---

## 1. MLOps Stack

| Concern | Tool | Purpose |
|---------|------|---------|
| Experiment tracking | MLflow | Log hyperparams, metrics, artifacts per training run |
| Dataset versioning | DVC | Version training datasets and model artifacts in Git |
| Feature store | Feast (Phase 2) | Serve pre-computed features to training and inference |
| Model registry | MLflow Model Registry | Staging → production promotion, version history |
| Orchestration | GitHub Actions (current) / Prefect (Phase 2) | Schedule and run training pipelines |
| Monitoring | Custom dashboards (Vercel logs + Supabase metrics) | Track inference latency, error rates, drift |
| Container registry | GitHub Container Registry | Docker images for training jobs |
| Compute (training) | GitHub Actions runners (small models) / spot instances (large) | Cost-efficient batch training |
| Serving | Vercel Edge Functions + ONNX Runtime (Phase 2) | Model inference at the edge |

---

## 2. Experiment Tracking with MLflow

Every training run logs:

```python
import mlflow

with mlflow.start_run(run_name=f"nsie-ml-{VERSION}"):
    # Log hyperparameters
    mlflow.log_params({
        "num_leaves": params["num_leaves"],
        "max_depth": params["max_depth"],
        "learning_rate": params["learning_rate"],
        "dataset_version": DATASET_VERSION,
        "feature_schema_version": FEATURE_VERSION,
        "train_size": len(X_train),
        "val_size": len(X_val),
    })
    
    # Log per-modality metrics
    for modality, metrics in eval_results.items():
        mlflow.log_metrics({
            f"{modality}_precision": metrics["precision"],
            f"{modality}_recall": metrics["recall"],
            f"{modality}_auc_pr": metrics["auc_pr"],
            f"{modality}_fpr_at_95recall": metrics["fpr_at_95recall"],
        })
    
    # Log overall metrics
    mlflow.log_metrics(overall_metrics)
    
    # Log artifacts
    mlflow.log_artifact("models/nsie-ml.onnx")
    mlflow.log_artifact("models/feature_stats.json")
    mlflow.log_artifact("models/calibrators.pkl")
    mlflow.log_artifact("reports/error_analysis.html")
    
    # Register model
    mlflow.register_model(
        f"runs:/{mlflow.active_run().info.run_id}/nsie-ml.onnx",
        "nsie-ml",
    )
```

MLflow server runs on a persistent instance (not Vercel — needs a database). Options:
- Self-hosted on a small VM with PostgreSQL backend
- Managed MLflow on Databricks or Weights & Biases (alternative)

---

## 3. Dataset Versioning with DVC

### 3.1 Directory structure

```
data/
├── raw/                          # DVC-tracked, never modified in place
│   ├── scans_labeled_20260101.parquet
│   └── scans_labeled_20260201.parquet
├── processed/                    # DVC-tracked, output of ETL
│   ├── features_20260101.parquet
│   └── features_20260201.parquet
├── splits/                       # DVC-tracked, train/val splits
│   ├── train_20260201.parquet
│   └── val_20260201.parquet
└── feature_stats/
    ├── mean_std_v1.json
    └── mean_std_v2.json

models/                           # DVC-tracked
├── nsie-ml-v1.0.0.onnx
├── nsie-ml-v1.1.0.onnx
└── calibrators/
    ├── url_v1.0.0.pkl
    └── text_v1.0.0.pkl
```

### 3.2 DVC workflow

```bash
# Track new dataset
dvc add data/raw/scans_labeled_20260201.parquet
git add data/raw/scans_labeled_20260201.parquet.dvc
git commit -m "data: add labeled scans through 2026-02-01"

# Run ETL pipeline (DVC pipeline tracks inputs → outputs)
dvc repro  # runs only stages whose inputs changed

# Push data to remote storage (S3 or GCS)
dvc push
```

DVC pipelines are defined in `dvc.yaml`:

```yaml
stages:
  etl:
    cmd: python scripts/etl.py
    deps:
      - data/raw/scans_labeled_20260201.parquet
      - scripts/etl.py
    outs:
      - data/processed/features_20260201.parquet

  split:
    cmd: python scripts/split.py
    deps:
      - data/processed/features_20260201.parquet
    outs:
      - data/splits/train_20260201.parquet
      - data/splits/val_20260201.parquet

  train:
    cmd: python scripts/train.py
    deps:
      - data/splits/train_20260201.parquet
      - data/splits/val_20260201.parquet
    outs:
      - models/nsie-ml-v1.1.0.onnx
      - models/feature_stats/mean_std_v2.json
    metrics:
      - reports/metrics.json
```

---

## 4. Feature Store (Phase 2 — Feast)

The current architecture computes features at scan time in the engine (synchronous) and re-extracts them at training time from stored scan data (offline). This creates two separate feature computation paths, which can diverge.

Feast addresses this with a unified feature registry:

**Online store (Redis):** pre-computed features for known entities, served at < 10ms latency at scan time

**Offline store (Parquet/S3):** historical feature snapshots for training

**Feature definitions:**
```python
from feast import Entity, Feature, FeatureView, FileSource, ValueType

entity = Entity(name="url_domain", value_type=ValueType.STRING)

features = FeatureView(
    name="url_features",
    entities=["url_domain"],
    ttl=timedelta(hours=4),
    features=[
        Feature(name="domain_age_days", dtype=ValueType.INT64),
        Feature(name="is_shortener", dtype=ValueType.BOOL),
        Feature(name="tld_suspicious", dtype=ValueType.BOOL),
        Feature(name="spamhaus_dbl", dtype=ValueType.BOOL),
        Feature(name="abuseipdb_score", dtype=ValueType.FLOAT),
    ],
    source=FileSource(path="data/features/url_features.parquet"),
)
```

The TTL on the online store ensures TI-derived features are refreshed when their data sources expire. This is the same TTL as the TI cache already in the engine.

**Migration path:** Phase 1 (current) stores features implicitly in the `scan_traces` table. Phase 2 extracts this into Feast. The engine interface doesn't change — only where features are read from.

---

## 5. Model Registry and Promotion

MLflow Model Registry tracks model versions through stages:

```
None → Staging → Production → Archived
```

**Staging:** model has passed all training evaluation criteria but has not been deployed. Shadow mode runs here.

**Production:** model is actively serving traffic. Only one `Production` model version per model name at a time.

**Archived:** previous production models. Never deleted — needed for reproducing past verdicts.

Promotion requires:
1. Training evaluation passed (see [`model-training.md §4.2`](model-training.md))
2. Shadow mode comparison passed (new model recall > current model recall, no precision regression)
3. Manual approval in MLflow UI by ML lead

Rollback: if a production model degrades, promote the previous `Archived` version back to `Production`. This takes < 5 minutes (no retraining needed).

---

## 6. CI/CD for Models

### 6.1 Training CI (GitHub Actions)

```yaml
# .github/workflows/train.yml
on:
  schedule:
    - cron: '0 2 * * 0'  # Every Sunday 02:00 UTC
  workflow_dispatch:       # Manual trigger

jobs:
  train:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: iterative/setup-dvc@v1
      - name: Pull training data
        run: dvc pull data/splits/
      - name: Train model
        run: python scripts/train.py --version ${{ github.sha }}
      - name: Evaluate
        run: python scripts/evaluate.py
      - name: Check graduation criteria
        run: python scripts/check_graduation.py  # exits 1 if criteria not met
      - name: Push model to registry
        run: python scripts/register_model.py
```

The `check_graduation.py` script asserts against the thresholds in [`model-training.md §4.2`](model-training.md). If criteria aren't met, the CI job fails and a Slack alert fires — no model is promoted automatically.

### 6.2 Deployment CD

Model deployment is separate from training CI. Triggered manually after MLflow staging approval:

```yaml
# .github/workflows/deploy-model.yml
on:
  workflow_dispatch:
    inputs:
      model_version:
        description: 'MLflow model version to deploy'
        required: true
```

The deployment script:
1. Downloads ONNX model from MLflow artifact store
2. Uploads to Vercel blob storage (or edge-accessible CDN)
3. Updates the `MODEL_VERSION` environment variable in Vercel
4. Vercel edge function picks up the new version on next cold start

---

## 7. Monitoring and Alerting

### 7.1 Inference metrics (real-time)

Tracked per scan in the `scans` table and aggregated:

| Metric | Tracked as | Alert threshold |
|--------|-----------|-----------------|
| `processingTimeMs` | stored per scan | P99 > 4000ms |
| `confidence` distribution | histogram (daily) | Mean confidence drops > 10% week-over-week |
| `riskLevel` distribution | histogram (daily) | `critical` rate doubles week-over-week |
| TI source failure rate | `sourcesFailed` in traces | > 20% failure rate for any single source |

### 7.2 Model-specific metrics (weekly, after retraining)

- Precision/recall on new analyst labels (rolling 7 days)
- PSI for key features
- Shadow mode lift vs. current model

### 7.3 Alert channels

- Vercel logs → filter on `ERROR` → Slack webhook (immediate)
- Supabase metrics → weekly digest email
- Training CI failure → GitHub notification + Slack
- Model degradation alert → Slack + email to ML lead

---

## 8. Cost Management

Training jobs are the primary variable cost:

| Job | Frequency | Compute | Estimated cost |
|-----|-----------|---------|---------------|
| Weekly LightGBM train (small dataset) | Weekly | 2 vCPU, 8 GB, 30 min | ~$0.05/run |
| Quarterly full retrain | Quarterly | 4 vCPU, 16 GB, 2 hours | ~$0.40/run |
| Text embedding fine-tune (Phase 2) | Quarterly | GPU (T4, 4 hours) | ~$3.00/run |
| Image CNN train (Phase 2) | Quarterly | GPU (T4, 8 hours) | ~$6.00/run |

Use spot/preemptible instances for training jobs — they can be interrupted and restarted; DVC pipeline ensures checkpointing.

MLflow server and DVC remote storage (S3) are the fixed ongoing costs: ~$20–50/month at small scale.
