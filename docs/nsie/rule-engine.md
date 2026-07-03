# NSIE — Rule Engine

> Module C of the Trust Engine. Source: `backend/src/engine/rules.ts`.
> Signal weights: `backend/src/engine/config/weights.ts` (matrix v2.1.4).
> Architecture context: [`trust-engine-architecture.md §3.4–§3.6`](../trust-engine-architecture.md).

---

## 1. Role

The rule engine is the first and fastest layer of NSIE. It runs synchronously, requires no network I/O, and completes in under 1 ms for any input. Its job is to detect clear-cut structural and linguistic patterns that are reliable indicators of scam activity.

The rule engine does **not** produce risk scores. It produces typed `Signal` objects that the risk engine (`risk.ts`) later accumulates. This separation means any rule can be added, removed, or re-weighted without touching scoring logic.

---

## 2. Dispatch Logic

`runRules(entity, text)` is the main entry point. Dispatch depends on the entity type returned by `entityFromScan()`:

| Entity type | Rules applied |
|-------------|--------------|
| `text` | Content rules over raw text |
| `email` | Content rules + identity rules (sender domain vs. claimed brand) |
| `url` | Content rules (on the raw URL string) |
| `upi` | `runUpiRules()` |
| `phone` | `runPhoneRules()` |
| `domain` | Identity rules (brand in domain) |

For `text` and `email` inputs, `extractEntities()` also pulls embedded URLs, UPI IDs, and phone numbers. Those are dispatched to their respective sub-pipelines and their signals are tagged `fromSubEntity = true`.

---

## 3. Content Rules

Run over any free text (messages, email bodies, URL strings).

| Signal ID | Pattern (abbreviated) | Base weight | Tier | Notes |
|-----------|----------------------|-------------|------|-------|
| `content.credential_request` | OTP, CVV, PIN, UPI PIN, MPIN | 32 | 3 | Never legitimate in unsolicited messages |
| `content.kyc_request` | KYC, re-KYC, Aadhaar, PAN card | 26 | 3 | All real KYC happens inside official apps |
| `content.urgency_threat` | blocked, suspended, expire, within 24h, act now | 16 | 3 | Artificial urgency pattern |
| `content.lottery_prize` | lottery, prize, won, KBC, cashback, gift | 22 | 3 | Bait-and-hook pattern |
| `content.job_upfront_fee` | work from home, part-time job, registration fee | 20 | 3 | Advance-fee job fraud |
| `content.loan_unsolicited` | instant loan, pre-approved, processing fee | 16 | 3 | Unsolicited loan offer |
| `content.payment_pressure` | pay now ₹X, pay to avoid, outstanding due | 18 | 3 | Urgency-payment combo |
| `content.too_good_returns` | guaranteed returns, risk-free, X% daily profit | 20 | 3 | Investment fraud |
| `content.contact_offplatform` | WhatsApp, Telegram, move this chat | 12 | 3 | Off-platform move to avoid detection |
| `content.attachment_or_apk` | .apk, install this app, enable unknown sources | 24 | 3 | Malware delivery signal |

**Category cap:** 35. Even if 10 content rules fire simultaneously, the total content contribution to the risk score is capped at 35.

---

## 4. Identity Rules

### 4.1 Brand impersonation (any text)

`BRAND_RE` matches 22 major Indian brands and platforms: SBI, HDFC, ICICI, Axis, Kotak, Paytm, PhonePe, Google Pay, NPCI, TRAI, Income Tax, EPFO, UIDAI, IRCTC, Amazon, Flipkart, Netflix, Microsoft, Apple, PayPal, RBI.

If any brand is mentioned in the text, fires `identity.brand_impersonation` (weight 14, tier 3).

### 4.2 Sender domain mismatch (email inputs only)

Maps each brand key to its canonical domains (e.g. SBI → `sbi.co.in`, `onlinesbi.sbi`). If the email's sender domain doesn't match the claimed brand's canonical domain list, fires `identity.sender_domain_mismatch` (weight 24, tier 3, evidence: `{claimedBrand, senderDomain}`).

This is a stronger signal than brand mention alone because it requires cross-referencing two different pieces of data.

### 4.3 Free email for company (email inputs only)

If the sender uses Gmail/Yahoo/Outlook/Hotmail/Rediffmail/ProtonMail while claiming to be a brand, fires `identity.free_email_for_company` (weight 12, tier 3). Note: this rule does not fire `sender_domain_mismatch` simultaneously to avoid double-counting the same evidence.

---

## 5. UPI Rules (`runUpiRules`)

Called for `upi` entity type and also for embedded UPI IDs found in text.

### 5.1 Unknown PSP (`pay.upi_unknown_psp`)

Validates the PSP suffix (everything after `@`) against 35 known PSP handles (oksbi, okhdfcbank, okicici, okaxis, paytm, ybl, ibl, upi, barodampay, kotak, etc.). An unknown PSP fires weight 18, tier 3. This catches newly created fraudulent PSPs and typosquatted variants.

### 5.2 Brand impersonation handle (`pay.upi_brand_impersonation`)

If the handle portion (before `@`) matches a brand name AND contains a scam-associated keyword (refund, kyc, verify, support, help, care, prize, bonus), fires weight 22, tier 3. Example: `sbi.refund@okaxis`.

### 5.3 Suspicious handle keyword (`pay.upi_suspicious_handle`)

If brand impersonation hasn't already fired, checks the handle for a broader set of scam keywords (`prize`, `winner`, `lottery`, `lucky`, `reward`, `refund`, `cashback`, `kyc`, `verify`, `helpline`, etc.). Fires weight 20, tier 2. Lower tier because keyword-in-handle is weaker evidence than brand+keyword combo.

### 5.4 Collect request (`pay.collect_request_unsolicited`)

Detects collect-request language in the surrounding context: "collect request", "approve payment", "receive ₹", "debit request". Fires weight 14, tier 3. A collect request is a payment pull — someone else asking you to approve money leaving your account.

### 5.5 UPI intent name mismatch (`pay.upi_intent_name_mismatch`)

For `upi://pay?pa=...&pn=...` URIs, checks whether the payee name (`pn`) claims a brand whose canonical PSPs don't include the actual VPA's PSP. Example: `upi://pay?pa=xyz@paytm&pn=SBI+Refund` — "SBI" claims its own PSPs are `oksbi/sbi`, not `paytm`. Fires weight 16, tier 3.

---

## 6. Phone Rules (`runPhoneRules`)

### 6.1 Invalid Indian mobile format (`phone.invalid_indian_mobile_format`)

Indian mobile numbers start with +91 and have local digits beginning 6–9 (TRAI allocation). A +91 number whose local part starts with 0–5 is invalid. Weight 30, tier 1 (tier-1 because TRAI numbering is a hard regulatory fact).

### 6.2 Premium-rate prefix (`phone.premium_rate_prefix`)

Checks for Indian premium-rate/VOIP prefixes: `91900x` (premium-rate), `91140x–91141x` (JioFi VOIP ranges). Weight 35, tier 1 — the highest non-override weight in the entire matrix. These numbers are disproportionately used in vishing campaigns.

### 6.3 Suspicious digit sequence (`phone.suspicious_sequence`)

Detects all-same-digit numbers (9999999999) and sequential numbers (1234567890, 9876543210). Weight 20, tier 2. Real phone numbers are random; these patterns indicate test data or fake numbers used in scam scripts.

### 6.4 International number claiming Indian bank (`phone.intl_claiming_indian_bank`)

If the context mentions an Indian brand (via `BRAND_RE`) but the phone number is not in +91 E.164 format, fires weight 20, tier 2. Catches overseas scam operations impersonating domestic banks.

---

## 7. Structural Collector (Separate, but logically part of Rule Layer)

`collectStructural()` in `collectors/structural.ts` runs URL/domain structural checks that are equivalent to rules but apply only to URL/domain entities. These use the `infra` category:

| Signal ID | Check | Weight |
|-----------|-------|--------|
| `infra.shortener` | URL uses a known link shortener | 24 |
| `infra.host_is_ip` | Host is a raw IP address | 22 |
| `infra.punycode_homoglyph` | IDN punycode homoglyph domain | 28 |
| `infra.brand_in_subdomain` | Brand name used as subdomain | 20 |
| `infra.suspicious_tld` | .xyz, .top, .win, .click, .tk, etc. | 14 |
| `infra.excessive_subdomains` | 4+ subdomain levels | 10 |
| `infra.at_symbol_in_url` | `@` in URL path/query | 16 |
| `infra.no_tls` | HTTP (not HTTPS) | 14 |
| `infra.redirect_chain_long` | 3+ redirect hops | 18 |
| `infra.tls_self_signed` | Self-signed certificate | 18 |
| `infra.tls_cn_mismatch` | Cert CN ≠ domain | 16 |
| `infra.via_qr_code` | Input arrived via QR code | 5 |

Infra category cap: 30.

---

## 8. Adding New Rules

1. Add the signal ID and weight to `WEIGHTS` in `engine/config/weights.ts`. Assign a category and tier.
2. Add the detection logic in `rules.ts` (or `collectors/structural.ts` for URL/domain checks). Call `signalFrom(id, source, confidence, evidence)`.
3. Bump `ENGINE_VERSION` in `engine/config/weights.ts`.
4. Write a unit test: input that should fire the rule, input that should not.

Never hardcode weights inside `rules.ts`. All weights are data in the matrix — this is the rule.

---

## 9. Rule Engine Limitations and Planned Extensions

**Current limitations:**
- Content rules use English patterns only. Hindi, Tamil, Bengali, and other regional languages are not covered.
- Rules are static regex — they don't adapt to new scam campaigns automatically.
- No word-embedding proximity (e.g. catching paraphrases of urgency language).

**Planned extensions:**
- Regional language keyword sets (additive — new BRAND_RE_HI, CONTENT_RULES_HI etc.)
- Fuzzy-match support for common OCR errors (e.g. `0TP` → `OTP`)
- ML-assisted rule generation: mine false negatives from production feedback to surface new regex candidates
- Dynamic blocklist rules: high-frequency user-reported phrases auto-promoted to content rules after threshold verification
