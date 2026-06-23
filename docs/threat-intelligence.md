# Threat Intelligence Sources

> **Task 4 deliverable.** Comparison of the external sources the Evidence
> Collection Layer ([`evidence-collection-layer.md`](evidence-collection-layer.md))
> queries. Each becomes a `Signal` with a **source tier** that scales its weight in
> [`scoring-matrix.md`](scoring-matrix.md).
>
> ⚠️ **Pricing/limits change.** Figures below are accurate to my knowledge as of
> early 2026 and are a *planning baseline* — confirm current terms and licensing
> (especially commercial-use clauses) before relying on them in production.

---

## 1. At-a-glance comparison

| Source | Covers | Availability | Free tier / cost | Rate limits (free) | Accuracy (precision/recall) | Integration | Commercial-use note |
|---|---|---|---|---|---|---|---|
| **Google Safe Browsing** (v4/v5 Lookup) | URLs: malware, social-engineering, unwanted SW | Public API, key required | Free for **non-commercial**; commercial → **Web Risk API** (paid, GCP, small free monthly quota) | ~10k req/day default (raisable) | Precision **very high**, recall high (Google scale) | **Easy** (REST) | ⚠️ Safe Browsing API is non-commercial; commercial products must use **Web Risk API** |
| **VirusTotal** | URL/domain/IP/file, 70+ engines | Public API + Premium | Free **non-commercial** only; Premium = $$$ | 4 req/min, 500/day, 15.5k/mo | Aggregated — high precision when several engines agree; noisy on single hits | **Easy** (REST) | ⚠️ Free tier prohibits commercial use; needs Premium for prod |
| **PhishTank** (Cisco) | Verified phishing URLs | Free API + hourly DB dump, key/registration | Free | Modest; prefer the bulk feed | **High precision** (human-verified), **low/medium recall**, slower freshness | **Easy** (feed/REST) | Free; registration sometimes gated |
| **OpenPhish** | Live phishing URLs | Free community feed + paid premium feeds | Community feed free (limited entries, periodic refresh); Premium paid | Feed download (not per-query) | High precision, good freshness (premium = better recall) | **Easy** (feed) | Premium needed for full coverage/commercial SLAs |
| **URLHaus** (abuse.ch) | Malware-distribution URLs/domains/payloads | Free API + bulk feeds (Auth-Key/account now required) | Free | Generous | High precision for malware (not phishing-focused) | **Easy** (REST/feed) | Free; respect abuse.ch acceptable-use |
| **Spamhaus** | IP & domain reputation (ZEN, DBL) | DNSBL + paid Data Query Service (DQS) | Free for **low-volume non-commercial** via DNS; DQS has a free-tier key | DNS-based; **public mirrors block high volume & public resolvers** | **Very high** (industry standard) | **Medium** (DNS queries; DQS key + operational caveats) | ⚠️ Commercial/high-volume requires DQS subscription |
| **AbuseIPDB** | IP abuse reputation (crowd-reported) | REST API, key required | Free tier (~1k checks/day); paid tiers scale up | ~1k/day free | Community-reported; good for hosting/IP abuse | **Easy** (REST) | Free tier OK for moderate use; paid for scale |
| **WHOIS / RDAP** | Registration data, **domain age**, registrar | RDAP (free, standard JSON) / raw WHOIS (port 43) | Free; paid APIs (WhoisXMLAPI etc.) for reliability | RDAP per-registry limits; raw WHOIS heavily throttled | Age/registrar reliable; contact data often **GDPR-redacted** | RDAP **easy**, raw WHOIS **hard** (unstructured) | Free; paid for reliability/normalization |
| **Domain Age APIs** (WhoisXMLAPI, IPQualityScore…) | Normalized domain age & risk | Paid APIs w/ free tiers | Free tier ~hundreds–1k/mo; then paid | Tier-dependent | Convenient, as good as underlying registry data | **Easy** (REST) | Can mostly be derived free from RDAP `creation date` |

---

## 2. Source detail & how we use it

### Google Safe Browsing / Web Risk — *Tier 1*
- **Use:** primary URL/domain blocklist; a `MALWARE` or `SOCIAL_ENGINEERING` hit is a
  **hard malicious override** (R=100) in the engine.
- **Caveat:** the free Safe Browsing API is **non-commercial**. A commercial Neural
  Shield must budget for **Web Risk API** (per-1,000-query pricing with a modest free
  monthly allotment). Plan for this cost early.
- **Integration:** use the Update/local-database mode where possible to cut per-query
  cost and latency (download hash prefixes, check locally, confirm full hashes only
  on prefix match).

### VirusTotal — *Tier 1 (multi-engine), treat aggregated*
- **Use:** corroboration. A single engine flag ≈ weak signal; **N-of-M engines** (e.g.
  ≥5/89) ≈ strong signal. Map the detection ratio to confidence, not a binary.
- **Caveat:** free tier is non-commercial + 4 req/min — far too slow for production
  scale. Use only for enrichment/backfill until on Premium; **never** put it on the
  hot path uncached.

### PhishTank — *Tier 1 for confirmed phish, Tier 2 freshness*
- **Use:** verified-phish exact/normalized URL match → hard malicious override.
- **Integration:** pull the hourly database dump into our own `threat_sources`-backed
  cache; do **not** hit their API per scan. High precision, but coverage is partial —
  combine with OpenPhish/URLHaus.

### OpenPhish — *Tier 1 (premium) / Tier 2 (free feed)*
- **Use:** real-time phishing feed; ingest into local cache. Premium feed materially
  improves recall and is worth it once volume justifies.

### URLHaus — *Tier 1 for malware URLs*
- **Use:** malware-distribution detection (complements GSB/phish feeds). Ingest bulk
  feed locally; exact/host match → strong-to-override depending on confidence.

### Spamhaus (ZEN + DBL) — *Tier 1 for IP/domain*
- **Use:** resolved-IP reputation (ZEN) and domain reputation (DBL) as strong signals.
- **Caveat:** **don't query via public DNS resolvers** (they're blocked) and don't
  exceed free-use volume — provision the **DQS** key with its own resolver for
  production. Operationally the fiddliest of the set.

### AbuseIPDB — *Tier 2*
- **Use:** abuse confidence score for the resolved hosting IP/ASN; supports "URL
  hosted on a known-abusive IP" signals. Crowd-sourced, so treat as corroborating,
  not decisive.

### WHOIS / RDAP — *Tier 1 for domain age (foundational)*
- **Use:** RDAP `events[].eventDate (registration)` → **domain age**, one of the most
  predictive scam signals (phishing domains are usually days old). Also registrar,
  privacy-proxy, nameservers.
- **Integration:** prefer **RDAP** (structured JSON, free, standardized) over raw
  WHOIS. Cache aggressively — age changes slowly.

### Domain Age APIs — *Tier 2 (convenience)*
- **Use:** fallback/normalization when RDAP is missing or rate-limited. Mostly
  redundant with RDAP — adopt only if RDAP coverage proves unreliable for the TLDs we
  see (some ccTLDs have poor RDAP).

---

## 3. Source tiers → weight multipliers

The engine scales each source's signal weight by a **reliability multiplier** tied to
its tier (used in [`scoring-matrix.md`](scoring-matrix.md) and the risk formula in
[`trust-engine-architecture.md`](trust-engine-architecture.md) §3):

| Tier | Meaning | Multiplier | Members |
|---|---|---|---|
| **1** | Authoritative, low false-positive | **1.0** | GSB/Web Risk, Spamhaus, RDAP age, PhishTank (verified), URLHaus, OpenPhish premium |
| **2** | Reliable but corroborating / crowd | **0.7** | VirusTotal aggregate, AbuseIPDB, OpenPhish free, Domain-age APIs |
| **3** | Heuristic / our own young reputation | **0.5** | structural heuristics, low-volume community reports |

Hard overrides (R=100) are reserved for **Tier-1 confirmed-malicious** hits with high
source confidence (GSB malware/social-engineering, verified PhishTank, URLHaus malware).

---

## 4. Recommended adoption order (cost-aware)

1. **Free + foundational, ship first:** RDAP (domain age), Google Safe Browsing
   (non-commercial during dev), URLHaus, PhishTank + OpenPhish feeds (ingested
   locally), Spamhaus DQS free key. Plus our **own reputation DB** (the cheapest and
   most valuable source).
2. **Add when scaling:** Web Risk API (commercial GSB), AbuseIPDB paid tier,
   VirusTotal Premium.
3. **Optional:** paid domain-age/risk APIs only if RDAP coverage is insufficient.

**Cost-control rules:** local feed mirrors over per-query APIs; verdict-aware caching
([`evidence-collection-layer.md`](evidence-collection-layer.md) §4); query slow/paid
sources only on cache miss; never block a user response on a Tier-2/3 source —
collect it async and update reputation for next time.

---

*Next:* [`trust-engine-architecture.md`](trust-engine-architecture.md) (Task 5) —
the full Input→Verdict pipeline with the risk, confidence, and reputation formulas.
