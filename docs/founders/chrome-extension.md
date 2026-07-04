# Chrome Extension

> **Priority 3.** A Manifest V3 extension that passively flags suspicious links as the user browses.
> Built with esbuild (`extension/build.mjs`). Shares the backend for optional batch analysis.

## What it does

- **Content script** (`content/content.ts`, runs at `document_idle` on every page): passively scans
  anchor `href`s for high-risk TLDs (`.xyz/.top/.tk/.ml/.ga/.cf/.gq/.pw`) and suspicious patterns
  (raw IP, "verify account", "secure login", "update kyc", "claim prize", "free money"), adds a ⚠
  badge, and reports a `medium` risk to the background worker. **No network calls** — lightweight and
  offline. Re-scans via a `MutationObserver` for single-page apps.
- **Background worker** (`background/worker.ts`): refreshes the auth token via `chrome.alarms`
  (every 10 min, ~5 min before expiry), handles messages (`PING`, `GET_AUTH`), and updates the
  per-tab badge.
- **Popup / options** (`popup/`, `options/`): UI + settings, including the API URL override.
- **API layer** (`src/api.ts`): `batchAnalyze` → `POST /api/extension/analyze` (Bearer JWT);
  `fetchExtensionConfig` → `GET /api/extension/config`.
- **Auth** (`src/auth.ts`): Supabase auth via REST; tokens in `chrome.storage`.

## Permissions (manifest)

`activeTab`, `storage`, `tabs`; `host_permissions: <all_urls>`. The broad host permission is what
lets the content script run everywhere — but note it does **no network I/O**, which keeps the risk
surface small.

## Security

- The analyze endpoint requires JWT/API-key auth.
- The content script does no network requests (can't exfiltrate).
- Extension origins (`chrome-extension://`) are explicitly allowed by the backend CORS logic.
- The Supabase URL + anon key are hardcoded in `extension/src/config.ts` — intentional and RLS-safe
  (public credential).

## Known issue (Priority 3)

`DEFAULT_API_URL = http://localhost:5000` — **must be overridden in the options page** for
production, or batch analysis won't work.

## Manifest V3 review notes (when this becomes a priority)
- Keep the background service worker minimal and event-driven (MV3 has no persistent background).
- Validate all messages passed between content/background/popup.
- Scope `host_permissions` as tightly as the feature allows.
- Follow the Chrome Web Store review guidelines before publishing (privacy disclosure for
  `<all_urls>`).

## Publishing (manual, owner)
Package via `build.mjs`, then upload the zip in the **Chrome Web Store Developer Dashboard**,
complete the privacy/permissions justification (especially for `<all_urls>`), and submit for review.
