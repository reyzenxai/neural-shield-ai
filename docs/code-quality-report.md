# Code Quality Report

An honest read of the codebase, app by app, with specific files called out. The headline is that the code is in good shape. It is typed, it is layered sensibly, and the hard part (the detection engine) is the best organized part of the whole project. Most of the findings below are about consistency across the four apps rather than problems inside any one of them.

## Overall

Strengths that show up everywhere:

- TypeScript is used seriously, with real types rather than `any` sprinkled around.
- The backend has a clean separation between the HTTP layer, the services, and the engine, and the engine itself is split into rules, collectors, intel, risk, and reputation in a way that is easy to follow.
- Error handling is deliberate. The mobile API client signs the user out on a 401, the extension refreshes tokens ahead of expiry, and the backend fails open in the engine so one dead collector never crashes a scan.
- Comments explain intent, not mechanics. For example `mobile/lib/api.ts` explains the profile retry because the Supabase trigger may not have created the row yet, which is exactly the kind of thing a future reader needs to know.

The weaknesses are almost all about the four apps having grown up separately.

## Naming and organization

- Package names do not follow a scheme. `frontend`, `neural-shield-backend`, `neural-shield-ai`, and `neural-shield-extension` sit side by side. The mobile app using the bare product name is the most confusing one. A shared scope such as `@neural-shield/web` fixes this during the workspace step.
- Folder names mix conventions. The web app groups by role (`components`, `hooks`, `lib`, `services`), the mobile app does something similar but with `constants` doing double duty for both types and config, and the backend groups by layer. This is fine within each app, but a reader moving between them has to re-learn the map each time.
- `mobile/constants/types.ts` holds types, a `SCAN_TYPES` config array, and UI copy all in one file. Splitting the type declarations from the config data would make both easier to find.

## Consistency across apps

This is where the real debt is, and it is covered in detail in `docs/refactoring-report.md`. The short version:

- The same types are declared four times and have already drifted. The backend still describes a scan result with `recommendation` and `detailedAnalysis`, while the clients expect the v2 shape with `confidence`, `signals`, `flags`, and `explanation`.
- The signal shape is not agreed on. The extension models a signal as a structured object, the mobile app treats signals as a plain string array. Both read from the same backend, so one of them is doing extra parsing to cope.
- Three API clients implement token handling three slightly different ways. None is wrong, but the differences are accidental, and a bug fixed in one will not reach the others.

## Backend

- The layering is good and the engine is the strongest part of the codebase. The design rule that only the risk engine produces numbers, and the language model only explains them, is enforced by structure, not just by comment.
- The controllers stay thin, which is the right call. Business logic lives in services and the engine.
- The one thing to watch is that `backend/src/types` is now behind the clients. Moving the canonical types into a shared package and having the backend import them will stop this from happening again.

## Web app

- Uses the current Next patterns correctly, including the renamed `proxy.ts` for route protection, which is easy to get wrong.
- Reads directly from Supabase for history and profile, and only uses the backend for scans and admin. That split is reasonable and keeps the backend off the read path for data the database can already secure with row level security.
- The admin area and the `api` routes have grown since the earlier audit. They deserve their own short doc so the boundary between "web server route" and "backend API route" stays clear.

## Mobile app

- Solid use of Expo primitives: secure store for the session, haptics, camera, and image picker for the scanners.
- The backend base URL is hardcoded in `mobile/lib/api.ts`. It should read from `EXPO_PUBLIC_API_URL` so a build can point at staging without a code edit. This is also a security and operations note in `docs/security-review.md`.
- `getProfile` in `mobile/lib/api.ts` does three sequential awaits (auth user, profile row, scan count). It works, but it is a candidate for a single RPC later if profile load ever feels slow.

## Chrome extension

- Clean MV3 setup with a real build step. The auth module handles token refresh 60 seconds before expiry, which is the right instinct.
- The Supabase URL and anon key are hardcoded in `extension/src/config.ts`. Same fix as the mobile URL: read from a build-time value so it can be rotated or repointed. Covered in the security review.
- The default API URL falls back to `http://localhost:5000`, which is correct for development but means a freshly installed extension does nothing until the user sets the API URL in options. Worth a first-run prompt or a sensible production default baked in at build time.

## Testing

- The backend has a real `node:test` suite. Good.
- The web, mobile, and extension apps rely on type checking and builds rather than tests. That is a reasonable starting point given where the risk actually lives (the engine, which is on the backend), but an end to end test that runs one scan from a client through the backend would catch the type drift described above before users do.

## Priorities

1. Consolidate the drifted types into `packages/types`. This removes a whole class of client and server disagreements.
2. Move the API client into `packages/sdk` so token handling is written once.
3. Environment-drive the two hardcoded values (mobile backend URL, extension Supabase config).
4. Split the mixed-purpose files (`mobile/constants/types.ts`) and give the web admin and api layers a short doc.
5. Keep the backend engine exactly as it is. It is the reference for how the rest of the codebase should be organized.
