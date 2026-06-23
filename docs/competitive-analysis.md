# Competitive Analysis

> **Task 9 deliverable.** Where Neural Shield fits against the incumbents, and the
> specific gaps it can exploit. Scope is deliberately constrained to the product goal:
> **website + browser-extension scam detection** (no mobile app), India-first.

---

## 1. Positioning in one line

The incumbents each own *one* surface — Truecaller owns the phone number, Google Safe
Browsing owns the malicious URL, the AV suites own the endpoint. **No one owns the
cross-signal, India-specific, explainable scam verdict across URL + email + phone + UPI
+ message in the browser.** That intersection is Neural Shield's wedge.

---

## 2. Competitor breakdown

### 2.1 Truecaller
- **Strengths:** Massive crowd-sourced phone/SMS reputation, huge brand recognition in
  India, caller-ID is a daily-use habit, spam-call/SMS labeling at scale.
- **Weaknesses:** Phone-number-centric — weak on URLs, email, UPI, and web content;
  primarily a mobile app (outside our scope but also means *no real browser/desktop
  story*); privacy concerns over contact upload; reactive (labels after spam spreads);
  shallow "why" (just "Spam" with a count).
- **Gaps NS exploits:** Truecaller can tell you a *number* is spammy; it can't tell you
  the *bit.ly link in that SMS* leads to a 4-day-old PhishTank-listed SBI clone. NS
  scores the **whole message** (link + UPI + sender + content) with provenance, in the
  browser where people read email/LinkedIn/job offers — a surface Truecaller doesn't
  cover.

### 2.2 Google Safe Browsing
- **Strengths:** Authoritative, Google-scale URL/malware blocklist; free (non-comm);
  baked into Chrome; extremely low false-positive rate; the gold-standard URL signal.
- **Weaknesses:** **URL-only** — nothing for phone/UPI/email-sender/job-fraud/SMS;
  binary verdict with no explanation; reactive (a brand-new phishing domain isn't
  listed until detected); no India-specific fraud taxonomy (UPI, KYC, KBC lottery); no
  user-facing reputation lookup or reporting loop for individuals.
- **Gaps NS exploits:** NS *consumes* GSB as one Tier-1 signal
  ([`threat-intelligence.md`](threat-intelligence.md)) but adds everything GSB lacks:
  domain-age + WHOIS + multi-source corroboration to **catch zero-hour phishing GSB
  hasn't listed yet**, plus phone/UPI/job coverage and a plain-language "why."

### 2.3 Norton (Gen Digital)
- **Strengths:** Established consumer-security brand; Safe Web URL ratings; bundles
  AV + VPN + identity; browser extension exists; scam-detection ("Genie") features.
- **Weaknesses:** Heavy paid suite; PC-centric/AV legacy; URL/site rating is the main
  browser value; weak India-specific fraud coverage (UPI/KYC/KBC); explanations are
  generic; not built around a crowd-sourced India reputation graph.
- **Gaps NS exploits:** Lighter, free-tier, India-native, single-purpose scam verdict
  vs. a heavyweight bundle; deeper coverage of Indian payment/job/message fraud; faster
  product iteration than a legacy suite.

### 2.4 Bitdefender
- **Strengths:** Top-tier malware engine and lab scores; TrafficLight browser
  extension rates links/search results; anti-phishing/anti-fraud web filtering;
  Scamio AI assistant.
- **Weaknesses:** Endpoint/AV-first; browser extension is an add-on to a paid suite;
  global tuning, not India-fraud-tuned (UPI/UPI-collect, KBC, Aadhaar-KYC, job-fee
  scams); limited user-facing reputation/reporting graph; explanations are not
  evidence-itemized.
- **Gaps NS exploits:** Same as Norton — be the focused, free-to-start, India-tuned,
  *explainable* layer; cover non-URL entities (phone/UPI/email-sender/job) the
  AV browser filter ignores.

### 2.5 Microsoft Defender (SmartScreen / Defender for consumers)
- **Strengths:** Default in Edge/Windows; SmartScreen URL+download reputation at huge
  scale; zero install for Edge users; strong enterprise phishing protection
  (Defender for Office 365).
- **Weaknesses:** Tied to Edge/Microsoft ecosystem (Chrome-first users uncovered);
  URL/download-centric for consumers; no UPI/phone/India-fraud taxonomy; minimal
  per-verdict explanation; consumer reporting loop is thin.
- **Gaps NS exploits:** Cross-browser (Chrome-first) extension; India fraud coverage;
  multi-entity verdicts; explainability + a public reputation lookup/report API.

---

## 3. Capability matrix

| Capability | Truecaller | GSB | Norton | Bitdefender | MS Defender | **Neural Shield (v2)** |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| Malicious **URL** detection | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ (aggregates GSB+VT+phish feeds+age) |
| **Phone** reputation | ✅ | ❌ | ⚠️ | ❌ | ❌ | ✅ (own crowd graph) |
| **UPI** fraud | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ **(unique)** |
| **Email sender** spoof / job fraud | ⚠️ | ❌ | ⚠️ | ⚠️ | ⚠️ | ✅ |
| **SMS / WhatsApp / message** scam | ✅ (phone) | ❌ | ⚠️ | ⚠️ | ❌ | ✅ (full content + entities) |
| India-specific fraud taxonomy | ⚠️ | ❌ | ⚠️ | ⚠️ | ⚠️ | ✅ **(core)** |
| **Explainable, evidence-itemized** verdict | ❌ | ❌ | ⚠️ | ⚠️ | ❌ | ✅ **(core)** |
| Browser-native (Chrome-first) | ❌ | ✅(Chrome) | ✅ | ✅ | ⚠️(Edge) | ✅ |
| Public reputation **lookup + report API** | ⚠️ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Free to start | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |

✅ strong · ⚠️ partial/weak · ❌ absent

---

## 4. The four gaps Neural Shield exploits

1. **The UPI/India-payment blind spot.** *No incumbent scores UPI IDs or
   amount-prefilled UPI QR fraud.* This is the #1 fraud vector in India and a category
   NS can own outright ([`evidence-collection-layer.md`](evidence-collection-layer.md) §3.5/§3.9).
2. **Cross-entity verdicts.** Everyone scores one entity type. NS scores the *whole
   artifact* — an SMS's link + UPI + sender + wording together — which is how scams
   actually arrive. The combination catches what any single-signal product misses.
3. **Explainability + provenance.** Incumbents say "unsafe." NS says *"domain is 4
   days old · on PhishTank · requests your KYC · impersonates SBI"* — the
   `scan_signals` trail ([`reputation-database.md`](reputation-database.md)). This
   builds user trust and is a wedge for the explainability-conscious Indian market.
4. **A community reputation graph as a public API.** Truecaller's crowd data is locked
   in its app. NS exposes reputation lookup + reporting via the **browser extension and
   an API** ([`chrome-extension.md`](chrome-extension.md) §6), turning every user into
   a sensor and every integration into distribution.

---

## 5. Risks / where incumbents are strong

Be honest about the moats we *don't* have yet:
- **Distribution & brand:** Truecaller/Google/Microsoft have hundreds of millions of
  users; NS starts at zero. → Win via the extension's low friction + a free, genuinely
  better India experience, then API/B2B (banks, marketplaces) for distribution.
- **Data scale:** GSB/SmartScreen see web-scale telemetry. → NS doesn't compete on raw
  URL scale; it *aggregates* those feeds and differentiates on India fraud + UPI +
  explainability + crowd reports.
- **Trust:** security is a trust purchase. → Lean on transparency (open evidence,
  no-AI-scoring determinism) as a *feature* incumbents can't easily copy.

---

*Next:* [`recommended-architecture.md`](recommended-architecture.md) (Task 10).
