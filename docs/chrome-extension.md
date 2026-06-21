# Chrome Extension Design

> **Task 8 deliverable.** Architecture, folder structure, permissions, and security
> model for the Neural Shield browser extension (Manifest V3). It is a thin,
> privacy-respecting client over the Trust Engine — it collects context and renders
> verdicts; **all scoring stays server-side**
> ([`trust-engine-architecture.md`](trust-engine-architecture.md)).

---

## 1. Goal & flow

Automatically analyze, in-page, with minimal friction:
- **Gmail / Outlook** emails (sender, links, body)
- **URLs** the user hovers/clicks or pages they land on
- **LinkedIn messages** & **job portals** (Naukri, Indeed, LinkedIn Jobs) for job-fraud
- **Suspicious websites** (login/payment pages on young/blocklisted domains)

```
Browser tab (content script, per-site adapter)
   │  extracts entities (sender, links, message text, job offer)  — minimal, hashed where possible
   ▼
Service worker (background, MV3)
   │  dedup + cache + batch  →  Bearer JWT / API key
   ▼
Neural Shield API  (POST /api/extension/analyze — batch)
   ▼
Trust Engine  (Evidence → TI → Rule → Reputation → Risk; AI explains)
   ▼
Verdict (R, T, C, band, signals, summary)
   ▼
Risk Banner / inline badge injected by the content script
```

---

## 2. Architecture

Three MV3 surfaces with a strict separation of duties:

| Surface | Responsibility | Trust |
|---|---|---|
| **Content scripts** (per-site adapters) | Read DOM, extract entities, inject the banner/badges. No secrets, no network to third parties. | Runs in hostile page context — treat the page as untrusted |
| **Service worker** (background) | Auth/session, request batching, dedup, local cache, all API calls. Single network egress point. | Holds the session; isolated from page |
| **Popup / Options** | Sign-in, settings (which sites are active), manual scan, report button, plan status | User-facing |

**Key decisions**
- **Server does all scoring.** The extension never ships rules/weights — those stay in
  the engine so they can't be reverse-engineered or bypassed, and so the moat (TI +
  reputation) is never exposed.
- **Reputation-cache first.** Most page links resolve to *already-known* entities;
  the service worker checks a local LRU cache, then the server cache
  ([`evidence-collection-layer.md`](evidence-collection-layer.md) §4), so most checks
  cost nothing and are instant.
- **Batch, don't flood.** A page with 40 links → one `POST /extension/analyze` with a
  deduped entity list, not 40 calls (this is why F-BE-3's caching + a batch endpoint
  are prerequisites).
- **Lazy & consented.** Passive scanning of page links is on by default for *URLs
  only*; reading **email/message bodies** is opt-in per provider (privacy + Web Store
  policy). Manual "Scan this" always available.
- **Privacy by minimization.** Prefer sending the *entity* (URL/sender/UPI), not whole
  message bodies. When body analysis is enabled, send a normalized excerpt or a
  client-side hash for template matching; never store raw content beyond the scan TTL.

---

## 3. Folder structure

```
extension/
├── manifest.json                 # MV3
├── src/
│   ├── background/
│   │   ├── service-worker.ts      # lifecycle, message router
│   │   ├── api-client.ts          # auth + POST /extension/analyze, retries, backoff
│   │   ├── cache.ts               # LRU reputation cache (entity → verdict, TTL)
│   │   ├── batcher.ts             # debounce + dedup entities per tab
│   │   └── auth.ts                # Supabase session / API key, token refresh
│   ├── content/
│   │   ├── core/
│   │   │   ├── extractor.ts       # generic link/UPI/phone/email extraction
│   │   │   ├── banner.ts          # Shadow-DOM risk banner renderer
│   │   │   ├── badge.ts           # inline per-link risk pill
│   │   │   └── messaging.ts       # postMessage ↔ service worker (typed)
│   │   └── adapters/
│   │       ├── gmail.ts           # Gmail DOM adapter
│   │       ├── outlook.ts         # Outlook OWA adapter
│   │       ├── linkedin.ts        # messages + jobs
│   │       ├── jobportals.ts      # naukri / indeed / shine
│   │       └── generic.ts         # any page: links + login/pay-form detection
│   ├── popup/                     # React (reuse frontend UI tokens / globals.css)
│   │   ├── Popup.tsx
│   │   └── index.html
│   ├── options/
│   │   ├── Options.tsx            # per-site toggles, body-scan consent, account
│   │   └── index.html
│   ├── shared/
│   │   ├── types.ts               # shared with backend Signal/ScanResultV2 contract
│   │   ├── entity.ts              # client-side normalization (mirror of engine §2)
│   │   └── config.ts
│   └── assets/                    # icons, banner styles (scoped)
├── tests/
├── vite.config.ts                 # @crxjs/vite-plugin or similar
├── tsconfig.json
└── README.md
```

Adapter pattern: each site adapter implements a common interface so adding a provider
is isolated:

```ts
interface SiteAdapter {
  matches(url: string): boolean;
  extract(): ExtractedContext;        // sender, links[], messageText?, jobOffer?
  mount(verdict: ScanResultV2, target: HTMLElement): void;  // where to put the banner
}
```

---

## 4. Permissions (manifest.json) — least privilege

```jsonc
{
  "manifest_version": 3,
  "name": "Neural Shield",
  "permissions": [
    "storage",          // settings + session token (chrome.storage.session for token)
    "activeTab",        // act on the user's current tab on demand
    "scripting",        // inject banner on demand (vs broad content_scripts)
    "alarms"            // periodic cache cleanup / token refresh
  ],
  "optional_host_permissions": [
    "https://mail.google.com/*",
    "https://outlook.live.com/*",
    "https://outlook.office.com/*",
    "https://*.linkedin.com/*",
    "https://www.naukri.com/*",
    "https://*.indeed.com/*"
  ],
  "host_permissions": [
    "https://api.neuralshield.ai/*"     // our API only
  ],
  "background": { "service_worker": "src/background/service-worker.ts", "type": "module" },
  "action": { "default_popup": "src/popup/index.html" },
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'; connect-src 'self' https://api.neuralshield.ai https://*.supabase.co"
  }
}
```

**Rationale**
- **No blanket `<all_urls>` content script.** Email/job-site adapters use
  `optional_host_permissions` — requested only when the user enables that provider.
  Generic page scanning uses `activeTab` + `scripting` (on click / on the active tab),
  which is the privacy-friendly, Web-Store-friendly pattern and avoids "reads all your
  data on all sites."
- **Single network destination** (`api.neuralshield.ai`) pinned in CSP `connect-src`.
- No `webRequest`/`webRequestBlocking` (deprecated/abuse-flagged); we observe via DOM,
  not by intercepting traffic.

---

## 5. Security model

Threat model: the **page is hostile**, the **network is hostile**, and the extension
is a high-value target (it sees emails). Controls:

| Risk | Control |
|---|---|
| Malicious page reads/poisons our UI | Banner & badges in a **closed Shadow DOM**; never use `innerHTML` with page-derived strings; render via DOM APIs / sanitized text only |
| Page steals the session token | Token stored in `chrome.storage.session` (cleared on browser close), **never** exposed to content scripts or the page; all authed calls happen in the service worker |
| XSS via verdict content (AI summary) | Treat server output as untrusted text; render as `textContent`, strict extension CSP, no inline scripts |
| Exfiltration of user data | Single pinned egress (`connect-src`), TLS only, minimization (send entities not bodies), body-scan opt-in, no third-party analytics by default |
| Prompt-injection from email body | Irrelevant to scoring (engine scores from evidence, not text — [`trust-engine-redesign.md`](trust-engine-redesign.md) §1); body is context only |
| Over-collection / Web Store rejection | Per-provider consent, clear privacy disclosure, `optional_host_permissions`, documented data flows |
| Replay / abuse of API | JWT/API-key auth, per-user rate limits (reuse `scanLimiter`), batch endpoint with a max entity count |
| Tampered extension build | Reproducible build, SRI on bundled assets, signed release, no remote code (MV3 forbids it anyway) |

**Auth.** Reuse Supabase Auth: the popup signs in (or pastes a Business API key); the
service worker holds the session and refreshes tokens (mirror the frontend's
`getSession()` flow in `frontend/src/services/scanner.ts`). On 401, refresh once then
prompt re-auth — same contract as the web client.

---

## 6. Backend additions required (for the extension)

These are new endpoints the engine must expose (also in
[`implementation-prompt.md`](implementation-prompt.md)):

| Endpoint | Purpose |
|---|---|
| `POST /api/extension/analyze` | **Batch** entity analysis: `{ entities: [{type,value}], context? }` → `ScanResultV2[]`. Cache-first; cheap for known entities. |
| `GET /api/reputation/:type/:value` | O(1) reputation lookup (badge color) without a full scan |
| `POST /api/report` | One-tap community report from the banner → `reports` table ([`reputation-database.md`](reputation-database.md)) |
| `GET /api/extension/config` | Per-user enabled providers, plan limits, engine version |

The banner's **"Report"** button is what turns extension users into the
crowd-sourcing engine behind the reputation moat.

---

*Next:* [`competitive-analysis.md`](competitive-analysis.md) (Task 9).
