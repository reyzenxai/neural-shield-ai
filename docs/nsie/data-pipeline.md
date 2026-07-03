# NSIE — Data Pipeline

> End-to-end flow from scan input to stored, labeled training data.
> Related: [`model-training.md`](model-training.md), [`continuous-learning.md`](continuous-learning.md).
> Current persistence: `backend/src/services/scan.service.ts`, Supabase `scans` table.

---

## 1. Pipeline Overview

```
User input
    │
    ▼
[1] Ingest & authenticate
    POST /api/scan/:type
    JWT/API-key verified → user_id resolved
    │
    ▼
[2] Normalize & classify
    entityFromScan() → Entity
    Entity type determines which sub-pipelines run
    │
    ▼
[3] Engine execution
    runEngine(scanType, content, opts)
    → ScanResultV2 (see nsie-overview.md §2)
    │
    ▼
[4] Persist
    INSERT into scans (user_id, scan_type, input_*, result columns)
    UPDATE reputation cache (upsert entity intel)
    │
    ▼
[5] Labeling pipeline (async, background)
    Community feedback → weighted_report_score update
    Analyst review (queued for review on high-volume reports)
    Verified labels written to scan_labels table
    │
    ▼
[6] Training data export
    Weekly ETL: scan_labels JOIN scans → feature vectors
    Written to training dataset (DVC-versioned)
    Used by model training (see model-training.md)
```

---

## 2. Stage 1 — Ingestion

Each scan endpoint (`/api/scan/message`, `/api/scan/url`, etc.) accepts the raw user input and authenticates the request:

- **Web/mobile:** Supabase JWT in `Authorization: Bearer` header, validated by the Axios interceptor and Supabase session
- **Enterprise API:** API key in header, looked up against `api_keys` table, resolved to a `user_id` for rate-limiting and scan attribution

Rate limiting enforced before engine execution:
- Free: 5 scans/day (daily_scan_count tracked in `profiles`)
- Pro: 100 scans/day
- Business: configurable, tracked separately

If the rate limit is exceeded, the request is rejected with a 429 before any engine work begins.

---

## 3. Stage 2 — Normalization

`entityFromScan(scanType, content)` canonicalizes the input:

| Scan type | Normalization |
|-----------|--------------|
| `message` / `text` | Trim whitespace; extract embedded entities |
| `url` | Parse URL, lowercase host, strip tracking params |
| `domain` | Lowercase, strip leading `www.` |
| `email` | Lowercase, parse sender domain and local part |
| `phone` | Strip non-digits, add country code prefix, E.164 form |
| `upi` | Lowercase VPA, parse handle and PSP suffix |
| `screenshot` | Run OCR → extracted text treated as `text` |
| `qr` | Decode QR payload → classify as url/upi/text, then normalize |

The normalized entity type and value are stored in the `scans` table. Both the raw input and the normalized form are preserved — raw for display, normalized for deduplication and reputation lookup.

---

## 4. Stage 3 — Engine Execution

See [`nsie-overview.md §2`](nsie-overview.md) for the full pipeline. From a data pipeline perspective, the engine execution produces:

```typescript
ScanResultV2 {
  scamProbability: number         // 0–1
  trustScore: number              // 0–100
  riskScore: number               // 0–100 (internal)
  riskLevel: RiskLevel            // safe | low | medium | high | critical
  confidence: number              // 0–1
  verdictLabel: string
  signals: Signal[]               // full signal trail
  decisionTrace: DecisionTrace    // override, fired rule IDs, sources
  flags: ScanFlag[]               // legacy UI format derived from signals
  summary: string                 // AI-generated
  recommendation: string          // AI-generated
  scamType: string                // AI-generated label
  engineVersion: string           // "trust-engine@2.1.4"
  processingTimeMs: number
}
```

This is the canonical result. Everything downstream reads from this object.

---

## 5. Stage 4 — Persistence

### 5.1 `scans` table

Key columns (see `database.md` for full schema):

| Column | Content |
|--------|---------|
| `id` | UUID primary key |
| `user_id` | FK to `auth.users` |
| `scan_type` | message / url / email / phone / upi / screenshot / qr |
| `input_text` | Raw text input (null for image scans) |
| `input_url` | URL input (null for text scans) |
| `scam_probability` | float |
| `trust_score` | float |
| `risk_level` | enum |
| `confidence` | float |
| `scam_type` | string (AI-generated) |
| `signals` | JSONB array of signal labels |
| `flags` | JSONB array of flag objects |
| `explanation` | AI-generated summary |
| `engine_version` | "trust-engine@2.1.4" |
| `created_at` | timestamp |

Row-level security (RLS): users can only read and delete their own rows. The reputation engine uses a service-role client for cross-user aggregation.

### 5.2 Reputation cache update

After each scan, TI collector results are upserted into the reputation entity intel table:

```
entity_type + entity_value (canonical) → source + verdict + fetched_at
```

TTL enforcement: records older than the per-source TTL (1–4 hours) are excluded from future cache reads but not deleted (historical intel is valuable for training data).

### 5.3 Decision trace storage

`decisionTrace` (fired rule IDs, sources queried/failed) is stored in a separate `scan_traces` table (not in `scans` to keep the main table lean). Used for:
- Debugging specific scan verdicts
- Analyzing which rules fire most frequently
- Identifying sources that fail disproportionately

---

## 6. Stage 5 — Labeling Pipeline

### 6.1 Community feedback (automated)

`submitFeedback(scanId, isAccurate, comment)` → `POST /api/report`

Inserts into `scan_reports`:
- `scan_id` → links to original scan
- `is_accurate` → false = "this verdict is wrong"
- `comment` → optional user-provided context

The `app_get_reputation` RPC aggregates reports into `weighted_report_score`. A high WS triggers the `reputation.community_override` signal on future scans of the same entity.

### 6.2 Analyst review queue

Scans that meet any of the following criteria are queued for manual analyst review:

| Criterion | Reason |
|-----------|--------|
| `is_accurate = false` with comment | User thinks verdict is wrong |
| `confidence < 0.35` | Low-certainty verdicts need human validation |
| `riskLevel = critical` with no override | High-stakes verdict produced by accumulation alone |
| Entity has `weighted_report_score ≥ 3` | Active community dispute |
| `scam_type` changed vs. previous scan of same entity | Possible verdict drift |

Analyst review is performed in the admin dashboard. Analysts can:
- Confirm the verdict (label: `true_positive` or `true_negative`)
- Overturn the verdict (label: `false_positive` or `false_negative`)
- Add a canonical scam type tag

### 6.3 Verified labels table

```sql
CREATE TABLE scan_labels (
  scan_id       uuid REFERENCES scans(id),
  label         text CHECK (label IN ('true_positive', 'false_positive',
                                      'true_negative', 'false_negative')),
  scam_type_tag text,              -- canonical scam category
  labeled_by    text,              -- 'community', 'analyst', 'auto'
  labeled_at    timestamptz DEFAULT now()
);
```

Labels from multiple sources are reconciled: analyst label always wins over community label. Auto-labels (from hard overrides with confidence ≥ 0.95) are accepted without human review.

---

## 7. Stage 6 — Training Data Export

### 7.1 ETL process

Weekly (every Sunday 02:00 UTC), a scheduled job runs:

```sql
SELECT
  s.*,
  sl.label,
  sl.scam_type_tag
FROM scans s
JOIN scan_labels sl ON sl.scan_id = s.id
WHERE sl.labeled_at > now() - interval '90 days'
  AND sl.label IN ('true_positive', 'true_negative')
```

This produces a dataset of scans with verified verdicts. Each row is then passed through the feature extraction pipeline (offline, not at scan time) to produce the numeric feature vectors.

### 7.2 Dataset schema

Each training example:
```json
{
  "id": "scan-uuid",
  "scan_type": "url",
  "label": 1,
  "label_source": "analyst",
  "scam_type": "phishing",
  "features": {
    "is_shortener": 0,
    "host_is_ip": 0,
    "domain_age_days": 3,
    "is_lt_7d": 1,
    "gsb_malware": 0,
    "gsb_social_engineering": 1,
    ...
  }
}
```

### 7.3 DVC versioning

The training dataset is tracked with DVC (Data Version Control):

```
data/
  train/
    scans_labeled_20260101.parquet   # DVC-tracked
    scans_labeled_20260108.parquet   # DVC-tracked
  feature_stats/
    mean_std_v1.json                  # normalization params
```

Each DVC dataset version is linked to the model version trained from it. This makes model lineage traceable: model `nsie-ml@1.2.0` was trained on dataset `scans_labeled_20260108.parquet`, which contains labels from `2025-10-09` to `2026-01-08`.

---

## 8. Data Quality Checks

Before each training run, automated checks validate the dataset:

| Check | Threshold | Action on failure |
|-------|-----------|-------------------|
| Class balance (scam/safe ratio) | 0.3 – 0.7 | Resample to balance |
| Minimum training examples per modality | 500 | Skip ML graduation for that modality |
| Feature coverage (non-null rate per feature) | > 60% | Drop feature for this run |
| Label agreement rate (community vs analyst) | > 80% | Flag for manual audit |
| Time range coverage (no gap > 14 days) | — | Log warning |

Data quality failures are logged and reported to the ML ops dashboard. Training runs on a degraded dataset are tagged as `low_quality` and are not promoted to production.

---

## 9. Privacy and Data Governance

- **Input text retention:** raw `input_text` is retained for 90 days (configurable), then deleted. Scan metadata (type, risk level, engine version) is retained indefinitely.
- **Training data:** only scans with verified labels are included in training data. Raw user input text is never shared with third parties for training purposes.
- **PII scrubbing:** before export, email addresses and phone numbers in `input_text` are replaced with `[REDACTED]` placeholders. This runs as part of the ETL process.
- **Opt-out:** users who delete their account (via the `handleDeleteAccount` flow in `profile.tsx`) have their scans deleted from `scans` and `scan_labels` tables. The entity reputation data is retained (it's aggregated and not PII) unless the entity value itself is the user's phone/email.
