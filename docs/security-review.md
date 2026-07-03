# Security Review

A focused pass over the repository looking for the things that actually hurt in production: exposed secrets, unsafe code, hardcoded values, weak validation, and risky dependencies. The good news up front is that there are no dangerous secrets committed to the tree, and the backend follows a least privilege model that holds up well. The findings are mostly about consistency and about the extension's permissions.

## Method

I scanned tracked source for private keys, service role keys, OpenRouter keys, Razorpay secrets, and JWT patterns, checked for committed `.env` files, and read the auth and config code in all four apps.

## What is safe

- No `.env` files are tracked. Only `.env.example` templates are committed, which is correct.
- No service role key appears anywhere in source. The backend reads `SUPABASE_SERVICE_ROLE_KEY` from the environment but does not use it, and the Supabase edge functions get it injected at runtime rather than from code.
- No OpenRouter key, Razorpay secret, or private key is present in tracked files. The only matches for those patterns are placeholders in `.env.example` and references in documentation.
- Row level security is enabled on every table, and the backend operates under the user's JWT rather than a privileged key, so the database enforces tenancy even if application code has a bug.

## Findings

### 1. Public anon key is hardcoded in several places
Severity: low

The Supabase anon key and project URL appear as literals in `extension/src/config.ts`, `mobile/eas.json` (all three build profiles), and the `test-scan.mjs` helper script. This key is public by design. It is meant to ship in client bundles and is protected by row level security, so this is not a secret leak. The issue is operational rather than a breach: because it is copied into several files, it cannot be rotated or pointed at a staging project without editing code in multiple places.

Recommendation: centralize it in `packages/config`, read it from a build-time environment variable in each app, and keep one value that every client shares. The mobile app already does this through `EXPO_PUBLIC_*`, so the fix is mostly about the extension and the test script following the same pattern.

### 2. Extension requests broad host permissions
Severity: medium

`extension/manifest.json` declares `host_permissions: ["<all_urls>"]` and runs its content script on `<all_urls>` at `document_idle`. For a tool that scans the page you are on for scam links, this is a defensible design, but it is also the single thing the Chrome Web Store review will look at hardest, and it is a real privacy surface because the content script sees every page.

Recommendation: document the justification clearly for the store listing, and consider whether `activeTab` plus a user action can cover the common case, with `<all_urls>` reserved for an explicit "scan this whole page automatically" mode that the user opts into. At minimum, make sure the content script only sends data to the backend when there is something to scan, not on every page load.

### 3. Extension stores tokens in `chrome.storage.local`
Severity: low

`extension/src/auth.ts` keeps the access and refresh tokens in `chrome.storage.local`, which is not encrypted at rest. This is the normal approach for extensions and there is no better primitive available, so this is a note rather than a defect. The token lifecycle itself is handled well, with a refresh 60 seconds before expiry.

Recommendation: keep token lifetimes short on the Supabase side, which they already are, and make sure a sign-out clears storage, which it does.

### 4. Mobile hardcodes the backend URL
Severity: low

`mobile/lib/api.ts` sets `API_BASE` to the production backend URL as a literal. This is not a secret, but it means a build cannot be pointed at a local or staging backend without a code change.

Recommendation: read it from `EXPO_PUBLIC_API_URL` with the production URL as the default, so QA and development builds can target other environments.

### 5. Development script tracked at the repo root
Severity: low

`test-scan.mjs` is a handy manual test that signs in and runs a URL scan, but it lives at the repository root and is tracked. It takes credentials as command line arguments rather than hardcoding them, so it is not a leak, but a root level test script is clutter and easy to run by accident.

Recommendation: move it into `scripts/` during the monorepo step and keep it there.

## Validation and input handling

The backend validates scan payloads with Zod schemas and strips HTML from text inputs, rate limits both globally and per scan, and gates the image scanners and the admin routes behind plan and role checks. The engine fails open, so a collector timeout lowers confidence rather than crashing the request, and the language model receives an already-decided verdict and cannot change the score. These are the right defaults and they are consistently applied.

The one area to keep an eye on is the admin surface. The mobile and web apps both call `/api/admin/*`, and the strength of that boundary depends entirely on the `is_admin` check being enforced on the server for every admin route, not just hidden in the client UI. That check should be verified route by route and covered by a test, since an admin API is exactly the kind of thing that gets a client-side guard and a forgotten server-side one.

## Dependencies

Each app manages its own dependencies today, which makes version skew and unused packages hard to see. Before the monorepo consolidation, run a dependency audit and a dead dependency check in each app. After consolidation, a single shared audit at the root covers everything at once. No specific vulnerable package was identified in this pass, but a scheduled `npm audit` in CI is worth adding so this does not depend on someone remembering to run it.

## Summary

| Finding | Severity | Fix |
|---------|----------|-----|
| Public anon key copied into several files | Low | Centralize in `packages/config`, env driven |
| Extension broad host permissions | Medium | Justify for store, consider `activeTab`, scan only when needed |
| Extension token storage unencrypted | Low | Accepted, keep tokens short lived and clear on sign out |
| Mobile hardcoded backend URL | Low | Read from `EXPO_PUBLIC_API_URL` |
| Root level test script tracked | Low | Move to `scripts/` |
| Admin route server side checks | Medium to verify | Confirm `is_admin` is enforced on every admin route, add a test |

Nothing here is an emergency. The two items worth doing before the next release are verifying the admin route checks and settling the extension permissions story, since both affect real users rather than just developer ergonomics.
