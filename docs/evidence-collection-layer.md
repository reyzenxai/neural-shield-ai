# Evidence Collection Layer

> **Task 3 deliverable.** The layer that turns each raw input into a normalized
> entity and a set of `Signal`s ([`trust-engine-redesign.md`](trust-engine-redesign.md) §4.1)
> for the engine to score. Fixes F-BE-1 (no evidence collection) and F-BE-2 (no
> URL normalization). Threat-intel source details are in
> [`threat-intelligence.md`](threat-intelligence.md); weights in
> [`scoring-matrix.md`](scoring-matrix.md).

---

## 1. Design

```
raw input ──► [1] Detect & route type ──► [2] Validate & normalize ──► entity
                                                                          │
                              ┌───────────────────────────────────────────┤
                              ▼                                            ▼
                    [3] Reputation lookup (own DB)              [4] Evidence collectors
                    cache hit? ── yes ──► return cached            (parallel, timeboxed)
                              │ no                                  ├─ threat-intel sources
                              ▼                                     ├─ infra (DNS/WHOIS/TLS)
                    [5] Collect → Signal[] ◄───────────────────────┤ ├─ content/structural rules
                              │                                     └─ cross-entity (links inside)
                              ▼
                    [6] Persist evidence + upsert reputation ──► engine
```

**Principles**
- **Normalize before lookup.** Every entity is canonicalized so the same thing is
  never two cache keys (`HTTP://Example.com/.` → `example.com`).
- **Fail open, never block.** Each collector has its own timeout; a dead source
  emits *no* signal and is recorded in `decisionTrace.sourcesFailed` (lowers
  Confidence, never crashes the scan). Contrast with today's all-or-nothing 502.
- **Cache-first.** Reputation DB is checked before any paid/rate-limited API.
- **Parallel + timeboxed.** Collectors run concurrently with a global budget
  (e.g. 4s) so latency ≈ slowest needed source, not the sum.
- **Cross-entity expansion.** A message/email/QR can *contain* URLs, phones, UPI
  IDs — these are extracted and recursively collected, and their signals roll up.

```ts
interface Collector {
  id: SourceId;
  appliesTo(entity: Entity): boolean;
  timeoutMs: number;
  collect(entity: Entity, ctx: Ctx): Promise<Signal[]>;  // never throws; [] on failure
}
```

---

## 2. Entity model

| Entity | Canonical form | Derived sub-entities |
|---|---|---|
| `url` | scheme+host+path, lowercased host, punycode-decoded, tracking params stripped | `domain`, `ip` (after DNS) |
| `domain` | registrable domain via Public Suffix List (eTLD+1) | `ip`, `nameservers` |
| `email` | `local@domain`, lowercased domain | `domain` |
| `phone` | E.164 (`+91…`), via libphonenumber | `country`, `carrier` (best-effort) |
| `upi` | `handle@psp`, lowercased | `psp` (bank/PSP suffix) |
| `text` (SMS/WhatsApp/job/website content) | trimmed, HTML-stripped, unicode-normalized (NFKC) | extracted `url`/`phone`/`upi`/`email` |

---

## 3. Per input type

For each: **Validation** (reject/normalize), **Evidence sources** (facts), and
**Reputation sources** (verdicts from us + others). Weights → [`scoring-matrix.md`](scoring-matrix.md).

### 3.1 URL
- **Validation:** valid scheme (`http`/`https`), length ≤ 2048 (matches
  `scan.schemas.ts:13`), parseable host. Reject `javascript:`/`data:`/`file:`.
  Normalize: punycode-decode host, lowercase, strip fragment + known tracking
  params, resolve to eTLD+1.
- **Evidence sources:**
  - **Redirect chain** — follow up to N hops (HEAD/GET, no body exec), record final
    landing domain. Expands shorteners (`bit.ly`, `tinyurl`, `t.co`…) — fixes F-BE-2.
  - **DNS** — A/AAAA/MX/NS records, resolved IP(s), ASN/hosting provider.
  - **WHOIS / RDAP** — domain creation date → **domain age** (a top signal).
  - **TLS cert** — issuer, age, CN/SAN mismatch with host, self-signed.
  - **Structural heuristics** — punycode/homoglyph host, excessive subdomains,
    brand-name-in-subdomain (`sbi.secure-login.xyz`), IP-as-host, suspicious TLD
    (`.xyz/.top/.win/.click` — already in `demo-analyze.ts`), `@` in URL, port tricks.
  - **Page content** (optional, sandboxed fetch) — login form presence, password
    field, brand logos vs. domain mismatch, obfuscated JS.
- **Reputation sources:** Google Safe Browsing, VirusTotal (URL), PhishTank,
  OpenPhish, URLHaus, AbuseIPDB (resolved IP), Spamhaus (IP/domain), **own
  `urls`/`domains` reputation tables + community reports**.

### 3.2 Domain
- **Validation:** valid hostname, PSL eTLD+1 extraction, IDN→punycode handling.
- **Evidence sources:** WHOIS/RDAP age + registrar + privacy-proxy flag, DNS, MX
  presence (no MX on a "bank" domain is suspicious), TLS, passive-DNS/age APIs.
- **Reputation sources:** GSB, VirusTotal (domain), Spamhaus DBL, URLHaus, own
  `domains` table + reports.

### 3.3 Email (address and/or full email)
- **Validation:** RFC-ish `local@domain` (≤320 chars, matches schema), domain
  resolvable.
- **Evidence sources (address):** domain age/MX, disposable-domain list, SPF/DKIM/
  DMARC records present, free-provider vs. claimed-brand mismatch
  (`hr-amazon@gmail.com`), homoglyph display-name vs. address.
- **Evidence sources (full email, if headers/body provided):** `From`/`Reply-To`/
  `Return-Path` mismatch, SPF/DKIM/DMARC *result* (if headers present), display-name
  spoofing, extracted URLs (→ recurse §3.1), attachment hints.
- **Reputation sources:** Spamhaus, own `emails` table + reports, sender-domain
  reputation (rolls up from §3.2).

### 3.4 Phone number
- **Validation:** libphonenumber parse to E.164; default region IN; reject
  impossible numbers. (Today's regex `^(\+?91)?[0-9]{6,12}$` is too loose — replace.)
- **Evidence sources:** number type (mobile/landline/VoIP/toll-free), carrier &
  circle (best-effort), is it a known shortcode/sender-ID pattern.
- **Reputation sources:** **own `phone_numbers` table + community reports (primary
  asset)**, optional external spam-number APIs. *(No paid Truecaller-style DB
  assumed; the moat is our own crowd-sourced reports — see
  [`competitive-analysis.md`](competitive-analysis.md).)*

### 3.5 UPI ID
- **Validation:** `handle@psp` (matches `scan.schemas.ts:40`), PSP suffix on a
  known-handle allowlist (`@oksbi`, `@okhdfcbank`, `@paytm`, `@ybl`…); unknown PSP
  suffix is itself a signal.
- **Evidence sources:** PSP validity, handle entropy/structure (random-looking
  handles, brand impersonation like `sbi.refund@…`), name-resolution mismatch (if a
  VPA→name verify API is available, compare claimed vs. resolved payee name).
- **Reputation sources:** **own `upi_ids` table + reports (primary asset)** — UPI
  fraud is India-specific and under-served by global TI, so our crowd-sourced DB is
  the differentiator.

### 3.6 SMS
- **Validation:** length 10–5000 (matches message schema), strip HTML.
- **Evidence sources:** extract URLs/phones/UPI (→ recurse), sender-ID pattern
  (DLT header `VK-SBIINB` vs raw 10-digit), rule-engine content signals (urgency,
  credential request, KYC, lottery, job-fee — the `demo-analyze.ts` rule set,
  promoted into the real Rule Engine).
- **Reputation sources:** reputation of every extracted entity; own message-pattern
  hashes (recurring scam templates).

### 3.7 WhatsApp text
- **Validation/normalize:** same as SMS; additionally detect forwarded-message
  markers, emoji-obfuscation, zero-width chars.
- **Evidence sources:** extracted entities (links/phone/UPI), investment/lottery/
  romance/job rule signals, "forwarded many times" hint if present, link to
  wa.me/click-to-chat numbers (→ phone recurse).
- **Reputation sources:** extracted-entity reputation; template-hash reputation.

### 3.8 Job offers
- **Validation:** treat as `text` (paste of offer / message / email).
- **Evidence sources (rule-driven):** up-front fee / "registration/joining fee,"
  too-good salary for stated effort, free-email recruiter domain vs. claimed company,
  WhatsApp-only contact, link to external portal (→ recurse), request for documents
  (Aadhaar/PAN) before any interview, mismatch between company name and email/URL
  domain. Optionally cross-check the *company domain* (§3.2).
- **Reputation sources:** recruiter email/domain/phone reputation, own `reports`
  tagged `job_fraud`, extracted company-domain reputation.

### 3.9 QR codes
- **Validation:** decode via existing `extract.service.ts` (jsQR); reject if no QR.
- **Evidence sources:** classify payload — `upi://` intent, `http(s)` URL, plain
  text, vCard, Wi-Fi. For UPI intent → parse VPA + amount + payee (→ §3.5). For URL
  → full §3.1. Flag **amount-prefilled UPI QRs** and payee-name/VPA mismatch
  (classic "scan-to-receive-but-actually-pay" fraud).
- **Reputation sources:** reputation of the decoded entity (URL/UPI).

### 3.10 Website content
- **Validation:** treat as `url` + fetched `text`. Sandboxed fetch only (no JS exec
  on our infra; render-on-demand optional later).
- **Evidence sources:** login/password form presence, brand assets vs. domain
  mismatch, copied-page fingerprint, payment-capture forms, obfuscated/minified
  inline JS,外部 form-action posting to a different domain, fake-trust-badges.
- **Reputation sources:** the page's URL/domain reputation (§3.1/§3.2).

---

## 4. Reputation lookup (the cache that becomes a moat)

Before calling any external/paid API:

```
key = entityType + ":" + canonicalForm        # e.g. "domain:sbi-kyc.xyz"
rec = reputation_db.get(key)
if rec and fresh(rec, ttlFor(verdict)):        # TTL: malicious 24h, clean 7d, unknown 1h
    emit cached reputation Signal; skip paid APIs for the slow ones
else:
    run collectors; upsert reputation_db with new evidence
```

TTL is verdict-aware: a confirmed-malicious record stays hot longer; "unknown" is
re-checked quickly. Community reports always refresh reputation immediately. This is
the layer that makes popular bad entities **cheap and instant** to flag (fixing
F-BE-3) and turns Neural Shield's traffic into a compounding data asset.

---

## 5. Output

The collection layer returns:

```ts
interface CollectionResult {
  entity: Entity;
  signals: Signal[];                  // everything the engine will score
  sourcesQueried: SourceId[];
  sourcesFailed: SourceId[];          // → lowers Confidence, never errors
  subEntities: CollectionResult[];    // links/phones/UPI found inside text/QR/email
}
```

This feeds straight into the Rule Engine → Risk Engine in
[`trust-engine-architecture.md`](trust-engine-architecture.md).

---

*Next:* [`threat-intelligence.md`](threat-intelligence.md) (Task 4) — the external
sources referenced above, compared on cost, limits, accuracy, and integration effort.
