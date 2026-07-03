# NSIE — 5-Year Evolution Roadmap

> Strategic plan for NSIE from 2026 to 2030.
> Current state: trust-engine@2.1.4, deterministic pipeline only.
> This document describes the trajectory — not a commitment to specific dates.
> Update this doc at each major phase completion.

---

## Phase 0 — Current State (2025)

**What exists:**
- 4-layer deterministic engine: rules → 11 TI collectors → reputation → risk math
- 7 scan modalities: text, URL, email, phone, UPI, screenshot (OCR), QR
- Claude via OpenRouter for explanation only (never scoring)
- Community reputation engine with weighted report scoring
- Web app, Chrome extension, mobile app (Expo), REST API
- Engine version: `trust-engine@2.1.4`

**Limitations:**
- No ML — detection is limited to patterns codifiable as rules and TI hits
- English-only content rules
- No voice/audio modality
- Reputation engine is per-entity (no graph propagation)
- No on-device inference (all scanning requires network)

---

## Phase 1 — ML Foundation (2026 H1)

**Goal:** graduate from rule-only detection to hybrid rule+ML, without sacrificing auditability.

**Milestones:**
1. Accumulate 10,000+ verified labeled scans (split ~5k scam / 5k safe)
2. Train LightGBM multi-task model per [`ml-architecture.md`](ml-architecture.md)
3. Ship shadow mode: ML runs in parallel, logs predictions, doesn't affect scores
4. 90-day shadow evaluation; validate graduation criteria from [`model-training.md §4.2`](model-training.md)
5. Promote to supplementary mode: ML signal injected at weight 20, tier 2
6. MLflow + DVC pipeline operational (see [`mlops.md`](mlops.md))
7. Weekly automated retraining pipeline live

**Success metrics:**
- ML recall > rule-only recall by ≥ 10 percentage points
- False positive rate stays below 3%
- Model training + evaluation automated end-to-end
- Verified label dataset growing at ≥ 500 new labels/week

**Technical deliverables:**
- `models/nsie-ml-v1.0.0.onnx` (5 modality heads: text, url, email, phone, upi)
- MLflow server operational
- `scripts/train.py`, `scripts/evaluate.py`, `dvc.yaml` in repository
- `scan_labels` table in production Supabase

---

## Phase 2 — Feature Depth and Graph Reputation (2026 H2)

**Goal:** close the recall gap on novel scam campaigns through deeper features and graph-based reputation.

**Milestones:**
1. Feast feature store operational (online + offline)
2. Reputation graph Phase 1: entity relationships stored in Postgres, 2-hop traversal via recursive CTE
3. Text embedding signal added (TF-IDF + logistic regression, multilingual tokenizer)
4. Screenshot CNN classifier (MobileNetV3-Small, identifies fake payment screenshots by visual layout)
5. Image OCR + visual features merged into single screenshot modality head
6. ML model promoted to supplementary mode (full traffic, not just canary)

**Success metrics:**
- Screenshot recall improves from OCR-only baseline
- Reputation graph propagation flags 15%+ more known-scam entities without new TI calls
- Feature store reduces feature computation latency from 200ms to < 50ms for cached entities

**Technical deliverables:**
- `nsie-ml-screenshot.onnx` (image classification head)
- Feast integration in `engine/features/` (offline and online serving)
- Graph traversal SQL function `get_propagated_reputation()` in Supabase
- `reputation_edges` table with domain-to-IP, same-registrant, co-reported relationships

---

## Phase 3 — Regional Languages and Voice (2027)

**Goal:** extend NSIE to cover India's linguistic diversity and the growing voice scam vector.

### 3.1 Regional language support

India's scam landscape is not English-only. The most impactful languages for NSIE:

| Language | Speakers (India) | Scam prevalence |
|----------|-----------------|-----------------|
| Hindi | 600M | Very high |
| Bengali | 100M | High |
| Telugu | 90M | High |
| Tamil | 80M | High |
| Marathi | 85M | Medium |
| Kannada | 55M | Medium |

**Implementation:**
- Rule engine: add parallel rule sets for each language (`CONTENT_RULES_HI`, `BRAND_RE_HI`, etc.)
- ML: fine-tune IndicBERT (multilingual BERT trained on 12 Indian languages) on labeled Indian-language scam data
- OCR: add Hindi/regional language OCR models for screenshot analysis (Tesseract supports Devanagari)

**Data requirement:** ~2,000 labeled scam examples per language before training. Community labeling campaigns and partnerships with NGOs working with rural populations are the primary data sources.

### 3.2 Voice/call scam detection

Voice scams (vishing) are the fastest-growing scam vector in India. Real-time call analysis is the target capability.

**Architecture:**
```
Incoming call (partner app integration)
    │
    ▼
[1] Real-time transcription (Whisper or cloud STT with low latency)
    │
    ▼
[2] Sliding window analysis (analyze last 30 seconds every 5 seconds)
    Text pipeline (content rules + ML)
    │
    ▼
[3] Risk accumulation (separate risk engine instance for voice)
    Temporal signal weighting (earlier signals decay, recent signals amplified)
    │
    ▼
[4] User alert
    In-call notification if risk > medium
    Post-call summary with signal analysis
```

**Integration path:** partner with a dialer app (or build a companion app) that can intercept audio stream via Android's `AudioRecord` API or iOS's `CallKit`. Neural Shield AI processes audio in a background service.

**Dataset for voice:** annotated call recordings. India's TRAI maintains records of reported scam calls. CERT-In threat feeds. Partnerships with banks who handle fraud complaint calls.

### 3.3 Differential privacy

Implement DP training (ε = 2.0) for all models trained on PII-adjacent features (phone number patterns, email domain distributions). This is a compliance requirement as NSIE scales to enterprise customers subject to PDPB (Personal Data Protection Bill).

---

## Phase 4 — Enterprise Intelligence Platform (2028)

**Goal:** transform NSIE from a consumer protection tool into an enterprise-grade threat intelligence platform.

### 4.1 Batch API with SLA guarantees

- Dedicated infrastructure (containerized, not serverless)
- Throughput: 10,000 scans/minute per enterprise tenant
- SLA: 99.9% uptime, P99 latency < 500ms
- Dedicated rate limits per API key
- Custom model fine-tuning: enterprise customers can submit labeled examples from their own domain; NSIE trains a tenant-specific model layer on top of the base model

### 4.2 Financial document fraud detection

Expand NSIE to detect fraudulent financial documents:
- Fake bank statements (altered account numbers, transaction histories)
- Fraudulent salary slips (used in loan applications)
- Fake GST invoices (B2B fraud)
- KYC document forgery detection

This requires:
- Document understanding model (LayoutLM or Donut for structured document parsing)
- Reference databases of genuine bank statement formats (partnerships with banks)
- Tamper detection: metadata analysis, font inconsistency detection, compression artifact analysis

### 4.3 Carrier-level SMS screening

Partnership with telecom carriers (Airtel, Jio, Vodafone-Idea) to screen SMS content at the carrier level before delivery — or post-delivery with a marking system (similar to spam labeling in email).

**API design:** carrier submits SMS content + sender metadata → NSIE returns risk score in < 100ms → carrier applies policy (deliver/block/mark-as-suspicious).

**Throughput requirement:** India's SMS volume is ~8 billion messages/day. Even 0.1% scan coverage = 8 million scans/day. This requires horizontally scaled infrastructure, distributed caching, and carrier-specific model optimization.

### 4.4 Threat intelligence sharing

NSIE's reputation data (entity scores, scam type classifications) becomes a commercial threat intelligence feed:
- STIX/TAXII compliant exports for enterprise SIEM integration
- CERT-In and RBI-compatible reporting formats
- Bilateral sharing agreements with partner banks and payment networks (e.g. NPCI)

---

## Phase 5 — Autonomous Intelligence Layer (2029–2030)

**Goal:** NSIE becomes self-improving with minimal human oversight, and extends into new threat vectors.

### 5.1 Online learning with automated labeling

Prerequisites met by 2029:
- Robust automated labeling pipeline (ground truth from TI confirmation, court records, CERT-In bulletins)
- Sufficient track record with batch retraining (failure modes understood)
- Legal framework for using call data for training (post-PDPB implementation)

River (Python online ML library) or a custom incremental LightGBM implementation enables per-scan weight updates without full retraining. The model adapts to novel scam patterns within hours of their first appearance, not weekly.

### 5.2 Deepfake and synthetic media detection

AI-generated content is already being used in scams (synthetic voice calls, deepfake video calls impersonating executives). NSIE's scope expands to:
- Audio deepfake detection (spectral analysis of artifacts from vocoders/TTS systems)
- Video deepfake detection (facial landmark inconsistency, compression artifacts, temporal coherence)
- Synthetic text detection (distinguishing AI-generated scam messages from human-authored ones)

### 5.3 Predictive threat intelligence

Instead of only reacting to known scam entities, NSIE learns to predict which newly registered domains or newly created UPI handles are likely to be used for fraud — before they're reported:

- Cluster newly registered domains by structural features (TLD, registrar, IP neighborhood, registration pattern)
- Assign a pre-crime risk score to entities that share characteristics with confirmed scam infrastructure
- Alert partners (banks, payment networks) before consumer harm occurs

**Risk:** false positives at this stage are high-stakes (legitimate new businesses flagged). Required confidence threshold for pre-crime flagging: > 0.92 with > 3 corroborating features. Human review required before any user-visible effect.

### 5.4 The NSIE competitive moat

By 2030, NSIE's proprietary advantage is:

1. **Indian-context depth:** the only ML system trained on 50M+ verified Indian-context scans across all modalities and regional languages
2. **Ground-truth network:** direct relationships with TRAI, CERT-In, major banks, and payment networks — data sources no competitor can replicate quickly
3. **Multi-modal graph:** the reputation graph connects entities across modalities, languages, and time in ways that single-modality systems fundamentally cannot
4. **On-device inference:** NSIE works without network connectivity (airplane mode, rural low-connectivity areas) — a real differentiator in the markets most affected by fraud
5. **Explainability at every layer:** auditable deterministic base + SHAP-explained ML additions — the only scam detection system that can explain every verdict in court-admissible terms

---

## Version History of This Document

| Date | Phase completed | Author |
|------|----------------|--------|
| 2025-12-01 | Phase 0 documented (current state) | NSIE team |
| 2026-07-01 | Initial roadmap drafted through Phase 5 | NSIE team |

Update this table at each phase milestone.
