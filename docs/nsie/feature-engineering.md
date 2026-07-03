# NSIE — Feature Engineering

> Feature extraction design for all 7 scan modalities.
> Used by: [`ml-architecture.md`](ml-architecture.md), [`model-training.md`](model-training.md).
> Current extraction lives in: `backend/src/engine/normalize.ts`, `collectors/structural.ts`, `rules.ts`.

---

## 1. Design Principles

Features in NSIE serve two purposes:

1. **Rule engine inputs:** pattern matching and structural checks that run today
2. **ML model inputs:** numeric feature vectors for the planned multi-task learning layer

Every feature must be:
- **Deterministic:** same input → same feature value (no randomness)
- **Extractable without labels:** computed from raw content, not from ground truth
- **Modality-specific where needed, shared where possible:** text features apply to messages, emails, and URL path strings; URL features apply to URLs, domains, and embedded links in text

---

## 2. Modality 1 — Text / Message

### 2.1 Content features (binary)

| Feature | Description |
|---------|-------------|
| `has_credential_request` | OTP, CVV, PIN, UPI PIN mentioned |
| `has_kyc_request` | KYC, Aadhaar, PAN mentioned |
| `has_urgency_language` | blocked, expire, within 24h, act now |
| `has_lottery_prize` | prize, won, lucky draw, KBC |
| `has_job_upfront_fee` | work from home, registration fee |
| `has_loan_offer` | instant loan, pre-approved, processing fee |
| `has_payment_pressure` | pay now, outstanding due |
| `has_investment_fraud` | guaranteed returns, risk-free, X% daily |
| `has_offplatform_move` | WhatsApp, Telegram, move this chat |
| `has_apk_link` | .apk, install this app, enable unknown sources |
| `has_brand_mention` | any of 22 known brands |
| `has_collect_request` | collect money, approve payment, debit request |

### 2.2 Structural features (numeric)

| Feature | Type | Description |
|---------|------|-------------|
| `text_length` | int | Character count |
| `url_count` | int | Number of URLs embedded in text |
| `phone_count` | int | Number of phone numbers embedded |
| `upi_count` | int | Number of UPI IDs embedded |
| `caps_ratio` | float | Fraction of uppercase characters |
| `special_char_ratio` | float | Fraction of special characters (!, ₹, @, #) |
| `hindi_char_ratio` | float | Fraction of Devanagari Unicode characters |
| `avg_word_length` | float | Average word length |
| `exclamation_count` | int | Count of `!` characters |
| `rupee_symbol_count` | int | Count of `₹` characters |
| `digit_ratio` | float | Fraction of digit characters |

### 2.3 Temporal features (future)

| Feature | Source |
|---------|--------|
| `received_hour_local` | When message was processed (hour of day) |
| `received_day_of_week` | Day of week |

Scam campaigns often have temporal signatures (batch SMS blasts at specific hours). These require timestamp data at ingest.

---

## 3. Modality 2 — URL

### 3.1 Structural features

| Feature | Type | Description |
|---------|------|-------------|
| `is_shortener` | bool | Known link shortener domain |
| `host_is_ip` | bool | Host is a raw IPv4/IPv6 address |
| `is_punycode` | bool | IDN/punycode encoding |
| `brand_in_subdomain` | bool | Brand name in subdomain levels |
| `tld_suspicious` | bool | .xyz, .top, .win, .click, .tk, .ml, .ga |
| `subdomain_depth` | int | Number of subdomain levels |
| `has_at_in_url` | bool | `@` in URL |
| `is_http` | bool | No TLS (http://) |
| `redirect_hops` | int | Number of redirect hops from expandUrl() |
| `path_length` | int | Length of URL path component |
| `query_param_count` | int | Number of query parameters |
| `has_suspicious_path_keyword` | bool | login, secure, update, verify in path |

### 3.2 Domain age features

| Feature | Source | Notes |
|---------|--------|-------|
| `domain_age_days` | RDAP | -1 if unavailable |
| `is_lt_7d` | derived | domain_age_days < 7 |
| `is_lt_30d` | derived | domain_age_days < 30 |
| `is_lt_90d` | derived | domain_age_days < 90 |
| `is_gt_2y` | derived | domain_age_days > 730 |
| `is_gt_5y` | derived | domain_age_days > 1825 |

### 3.3 TLS features

| Feature | Source |
|---------|--------|
| `tls_valid` | TLS collector |
| `tls_self_signed` | TLS collector |
| `tls_cn_mismatch` | TLS collector |
| `tls_days_until_expiry` | TLS collector |

### 3.4 TI collector results (binary)

| Feature | Source |
|---------|--------|
| `gsb_malware` | Google Safe Browsing |
| `gsb_social_engineering` | Google Safe Browsing |
| `phishtank_verified` | PhishTank |
| `urlhaus_malware` | URLHaus |
| `openphish_match` | OpenPhish |
| `vt_ratio` | float 0–1, VirusTotal |
| `spamhaus_dbl` | Spamhaus |
| `spamhaus_zen` | Spamhaus |
| `abuseipdb_score` | float 0–100 |
| `dns_low_ttl` | DNS TTL < 300s |
| `dns_sinkholed` | Resolves to sinkhole IP |

---

## 4. Modality 3 — Email

Email inherits all text features (on body) and all URL features (on sender domain and embedded links). Additional email-specific features:

| Feature | Description |
|---------|-------------|
| `sender_domain_free_email` | Sender uses Gmail/Yahoo/Outlook/etc. |
| `sender_domain_mismatch` | Sender domain ≠ brand's canonical domain |
| `spf_pass` | SPF authentication result |
| `dkim_pass` | DKIM authentication result |
| `dmarc_pass` | DMARC policy evaluation |
| `subject_urgency` | Urgency/threat language in subject line |
| `subject_prize` | Prize/lottery language in subject line |
| `embedded_url_count` | Number of URLs in email body |
| `html_link_text_mismatch` | Link display text ≠ href destination |

---

## 5. Modality 4 — Phone

| Feature | Type | Description |
|---------|------|-------------|
| `country_code` | string | E.164 country code prefix |
| `is_indian_mobile` | bool | +91 with valid local prefix |
| `is_premium_rate` | bool | Known premium-rate prefix |
| `has_suspicious_sequence` | bool | All-same or sequential digits |
| `is_intl_claiming_indian_bank` | bool | Non-+91 number + brand mention in context |
| `local_prefix` | int | First digit of local number (6–9 = valid Indian) |
| `number_length` | int | Total digit count |

---

## 6. Modality 5 — UPI / Payment

| Feature | Type | Description |
|---------|------|-------------|
| `psp_suffix` | string | Extracted PSP (part after @) |
| `is_known_psp` | bool | PSP in the 35-item known PSP list |
| `handle_has_scam_keyword` | bool | prize, kyc, refund, etc. in handle |
| `handle_claims_brand` | bool | Brand name in handle |
| `brand_psp_mismatch` | bool | Claimed brand's PSP ≠ actual PSP |
| `is_collect_request` | bool | Context contains collect-request language |
| `intent_name_mismatch` | bool | UPI intent pn ≠ VPA PSP brand |
| `handle_length` | int | Character count of handle (before @) |
| `psp_age_rank` | int | Ordinal rank of PSP by creation date (known PSPs only) |

---

## 7. Modality 6 — Screenshot (Image)

Images go through OCR first. The extracted text is then treated as a text input (modality 1). Additional image-level features:

| Feature | Type | Source |
|---------|------|--------|
| `ocr_text_length` | int | Characters extracted from image |
| `ocr_confidence` | float | Tesseract confidence score |
| `ocr_has_upi_id` | bool | UPI VPA pattern found in OCR text |
| `ocr_has_phone` | bool | Phone number pattern found |
| `ocr_has_url` | bool | URL pattern found |
| `ocr_has_amount` | bool | ₹ + digit pattern found |
| `ocr_has_bank_name` | bool | Any bank brand in OCR text |
| `is_dark_background` | bool | Heuristic for screenshots vs. photos |
| `image_aspect_ratio` | float | Height/width ratio |

**Future — visual feature extraction:**
Without OCR, screenshots can be classified by visual layout (page templates, color schemes, form fields) using a lightweight CNN. This would catch visually convincing fake bank login screens even when OCR quality is poor.

---

## 8. Modality 7 — QR Code

QR codes decode to a string payload, which is then classified:
- If the payload is a URL → full URL pipeline (modality 2)
- If the payload is a UPI intent URI → UPI pipeline (modality 5)
- Otherwise → text pipeline (modality 1)

QR-specific features:

| Feature | Description |
|---------|-------------|
| `via_qr_code` | Always true for QR inputs (injects `infra.via_qr_code` signal, weight 5) |
| `qr_payload_type` | url / upi / text / other |
| `qr_version` | QR code version (1–40; higher = denser = more data) |
| `qr_error_correction` | L/M/Q/H — H level is unusual for legitimate payment QRs |

---

## 9. Feature Vector Assembly for ML

For the multi-task ML model (see [`ml-architecture.md`](ml-architecture.md)), features are assembled into a fixed-length numeric vector:

1. **Categorical features** (entity type, TLD, PSP suffix, country code) → one-hot or embedding lookup
2. **Binary features** → 0.0 / 1.0
3. **Integer features** → normalized to [0, 1] using log1p scaling (counts can be very skewed)
4. **Float features** → already in [0, 1] or normalized per-feature using training-set statistics
5. **Missing values** → fill with −1.0 (a distinct value, signals "data not available" rather than "zero")

Feature standardization parameters (mean, std) are computed on the training set and stored as model artifacts alongside the ONNX model (see [`model-deployment.md`](model-deployment.md)).

---

## 10. Feature Stability Requirements

Any feature used in ML training must:
1. Be computable in production at scan time with the same logic as training time
2. Not depend on ground-truth labels (no label leakage)
3. Be versioned: if the extraction logic changes, the feature gets a new name (e.g. `tld_suspicious_v2`)
4. Have a defined behavior for missing data (logged, not silently dropped)

Feature engineering changes that alter existing feature semantics require a full model retrain (see [`model-training.md`](model-training.md)).
