# Scoring Matrix

> **Task 6 deliverable.** Every signal weight, category cap, and override used by
> the Risk Engine ([`trust-engine-architecture.md`](trust-engine-architecture.md) §3).
> These are **starting values** — they are meant to be tuned against labeled feedback
> (Phase C in [`trust-engine-redesign.md`](trust-engine-redesign.md) §6). Keep this
> file as the single source of truth; the code should load weights from a versioned
> config, not hard-code them.

**Reading the table:** `weight` is the *base* `wᵢ`. Effective contribution is
`wᵢ · confidence · sourceTier` ([`trust-engine-architecture.md`](trust-engine-architecture.md) §2).
Positive = raises risk; negative = raises trust. `id` is the stable signal key.

---

## 1. Categories & caps

Positive contributions are summed **per category** then clamped at the cap (stops any
one category from dominating). Caps sum well above 100 by design — reaching `R=100`
without an override requires corroboration across *multiple* categories.

| Category | `id` prefix | Cap (CAP_k) | Rationale |
|---|---|---|---|
| Blocklist / Threat-intel | `ti.` | 60 | Authoritative; can nearly decide alone |
| Domain age / registration | `domain.` | 30 | Strong but not sufficient alone |
| Infrastructure (URL/DNS/TLS/IP) | `infra.` | 30 | Structural redirection/hosting risk |
| Content / linguistic | `content.` | 35 | Many weak text signals must not run away |
| Identity / impersonation | `identity.` | 30 | Brand spoofing, sender mismatch |
| Community / reputation | `reputation.` | 50 | Our moat; trusted reports weigh heavily |
| Payment-instrument (UPI/QR) | `pay.` | 35 | India-specific fraud surface |

---

## 2. Hard overrides

| Override | Trigger (`id`) | Effect | Guard |
|---|---|---|---|
| **Malicious** | `ti.gsb.malware`, `ti.gsb.social_engineering`, `ti.phishtank.verified`, `ti.urlhaus.malware`, `ti.openphish.match` | `R = 100`, band = critical | sourceTier 1 AND confidence ≥ 0.9 |
| **Malicious (community)** | `reputation.community_override` | `R = 100`, band = critical | ≥ N independent trusted reports (N≥3), confirmed status |
| **Allowlist** | `identity.verified_org`, `reputation.trusted_domain` | `R = min(R, 10)` | only if **no** malicious override present |

Malicious always beats allowlist (a compromised trusted domain is still dangerous).

---

## 3. Positive (risk-raising) signals

### 3.1 Threat-intel / blocklist  `ti.*`  (cap 60)
| id | weight | notes |
|---|---|---|
| `ti.gsb.malware` | override | hard malicious |
| `ti.gsb.social_engineering` | override | hard malicious |
| `ti.phishtank.verified` | override | hard malicious |
| `ti.urlhaus.malware` | override | hard malicious |
| `ti.openphish.match` | override | hard malicious |
| `ti.virustotal.ratio_high` (≥5 engines) | +45 | weight ∝ detection ratio |
| `ti.virustotal.ratio_low` (1–4 engines) | +18 | corroborating only |
| `ti.spamhaus.dbl` (domain) | +40 | tier-1 |
| `ti.spamhaus.zen` (resolved IP) | +30 | tier-1 |
| `ti.abuseipdb.high` (≥75% confidence) | +25 | hosting IP abuse |
| `ti.abuseipdb.low` (25–74%) | +12 | |

### 3.2 Domain age / registration  `domain.*`  (cap 30)
| id | weight | notes |
|---|---|---|
| `domain.age_lt_7d` | +30 | freshly registered = top phishing signal |
| `domain.age_lt_30d` | +25 | |
| `domain.age_lt_90d` | +15 | |
| `domain.age_lt_1y` | +6 | mild |
| `domain.privacy_proxy` | +6 | WHOIS privacy on a "brand" domain |
| `domain.no_mx_for_brand` | +10 | "bank" domain with no mail records |
| `domain.disposable_registrar` | +8 | abuse-prone registrars |

### 3.3 Infrastructure  `infra.*`  (cap 30)
| id | weight | notes |
|---|---|---|
| `infra.shortener` | +24 | bit.ly/tinyurl/t.co… (from `demo-analyze.ts`) |
| `infra.redirect_chain_long` (≥3 hops) | +18 | |
| `infra.host_is_ip` | +22 | IP literal instead of hostname |
| `infra.punycode_homoglyph` | +28 | `аррӏе.com` lookalike |
| `infra.brand_in_subdomain` | +20 | `sbi.secure-login.xyz` |
| `infra.suspicious_tld` (.xyz/.top/.win/.click) | +14 | |
| `infra.excessive_subdomains` (≥4) | +10 | |
| `infra.at_symbol_in_url` | +16 | `http://good.com@evil.com` |
| `infra.tls_self_signed` | +18 | |
| `infra.tls_cn_mismatch` | +16 | cert host ≠ URL host |
| `infra.no_tls` (http on a login/pay page) | +14 | |

### 3.4 Content / linguistic  `content.*`  (cap 35) — *promoted from `demo-analyze.ts`*
| id | weight | notes |
|---|---|---|
| `content.credential_request` (OTP/PIN/CVV/password) | +32 | never legitimate over msg |
| `content.kyc_request` (KYC/Aadhaar/PAN update) | +26 | |
| `content.urgency_threat` (block/suspend/24h/act now) | +16 | |
| `content.lottery_prize` (won/KBC/lucky draw) | +22 | |
| `content.job_upfront_fee` (registration/joining fee) | +20 | |
| `content.loan_unsolicited` (pre-approved + fee) | +16 | |
| `content.payment_pressure` (pay now to avoid X) | +18 | |
| `content.too_good_returns` (guaranteed/double money) | +20 | investment fraud |
| `content.contact_offplatform` (move to WhatsApp/Telegram) | +12 | |
| `content.attachment_or_apk` (install this APK) | +24 | malware delivery |
| `content.grammar_anomaly` | +6 | weak, corroborating |

### 3.5 Identity / impersonation  `identity.*`  (cap 30)
| id | weight | notes |
|---|---|---|
| `identity.brand_impersonation` (SBI/HDFC/NPCI/TRAI…) | +14 | base; +more if domain mismatch |
| `identity.sender_domain_mismatch` (From vs brand) | +24 | `hr-amazon@gmail.com` |
| `identity.reply_to_mismatch` | +18 | |
| `identity.spf_dkim_dmarc_fail` | +22 | when headers available |
| `identity.display_name_spoof` (homoglyph name) | +16 | |
| `identity.free_email_for_company` | +12 | recruiter on gmail claiming a corp |

### 3.6 Payment-instrument  `pay.*`  (cap 35) — *India-specific*
| id | weight | notes |
|---|---|---|
| `pay.upi_unknown_psp` (suffix not on allowlist) | +18 | |
| `pay.upi_brand_impersonation` (`sbi.refund@…`) | +22 | |
| `pay.upi_payee_name_mismatch` (claimed ≠ resolved) | +24 | if VPA-verify available |
| `pay.qr_amount_prefilled` | +20 | "scan to receive" that actually debits |
| `pay.qr_payee_vpa_mismatch` | +22 | |
| `pay.collect_request_unsolicited` | +14 | |

### 3.7 Community / reputation  `reputation.*`  (cap 50)
| id | weight | notes |
|---|---|---|
| `reputation.community_abuse` | up to +50 | scaled by `Rep_risk/100` ([`trust-engine-architecture.md`](trust-engine-architecture.md) §8) |
| `reputation.prior_scam_verdict` (we flagged it before, confirmed) | +30 | |
| `reputation.template_hash_known` (recurring scam text) | +20 | |
| `reputation.community_override` | override | ≥N trusted reports |

---

## 4. Negative (trust-raising) signals
| id | weight | notes |
|---|---|---|
| `identity.verified_org` | allowlist override / −40 | curated verified entities |
| `reputation.trusted_domain` | allowlist override / −30 | curated trusted list (major banks, govt .gov.in/.nic.in, large brands) |
| `domain.age_gt_5y` | −20 | long-established |
| `domain.age_gt_2y` | −10 | |
| `infra.valid_ev_dv_tls` (clean cert, matching host) | −6 | |
| `identity.spf_dkim_dmarc_pass` | −12 | authenticated sender |
| `reputation.clean_history` (many clean scans, no reports) | −15 | |
| `pay.upi_psp_known + name_match` | −10 | |

> Negative signals are **not** capped per-category, but the allowlist override is the
> dominant trust mechanism. A malicious override always wins over any trust signal.

---

## 5. Confidence inputs (recap)

Confidence is computed from coverage/reliability/agreement, **not** from this matrix
([`trust-engine-architecture.md`](trust-engine-architecture.md) §5). The `sourceTier`
column that scales weights also feeds `Reliability`. Tier multipliers: T1 = 1.0,
T2 = 0.7, T3 = 0.5 ([`threat-intelligence.md`](threat-intelligence.md) §3).

---

## 6. Tuning protocol

1. Ship these defaults behind `engineVersion = "trust-engine@2.0.0"`.
2. Log every `Signal` + final `R` + (when available) the ground-truth label from the
   `feedback` table → `scan_signals` ([`reputation-database.md`](reputation-database.md)).
3. Weekly: compute precision/recall per band; identify signals with poor
   discrimination (high firing rate on clean inputs) and down-weight them.
4. When ≥ a few thousand labeled outcomes exist, fit the logistic calibration
   (`a, b`) and consider learning weights via L2-regularized logistic regression —
   but **keep hard overrides rule-based** (never let a learned model relax a confirmed
   blocklist hit). Bump `engineVersion` on every weight change for reproducibility.

---

*Next:* [`reputation-database.md`](reputation-database.md) (Task 7) — the schema that
stores these signals, reports, and per-entity reputation.
