# Refactoring Report

This report lists what should change, why, and how, based on a full read of the current tree. It is deliberately concrete. Where a change is safe to make on its own, the exact steps are here. Where a change touches a live deployment or the workspace layout, it is described here and sequenced in `docs/migration-guide.md`.

## A note on what was and was not executed

The repository currently has active, uncommitted work: 34 untracked files and 27 modified files, mostly new mobile screens and the `docs/nsie/` engine docs. Editing or moving files on top of unsaved work is how work gets lost or how a diff turns into a mess that is hard to review. So this pass documents the refactors with exact commands rather than running them over your in-progress changes. Once the working tree is committed or stashed, the safe items below can be applied in minutes. The larger structural move is a separate, staged effort.

## 1. Shared code that is copied instead of shared

This is the biggest source of drift in the codebase. The same ideas are written three or four times, and they have already started to disagree with each other.

### Types
Scan types, risk levels, plans, and the scan result shape are declared independently in:

- `frontend/src/types/index.ts`
- `mobile/constants/types.ts`
- `backend/src/types/`
- `extension/src/api.ts` (its own `Entity` and `EntityResult`)

They are not identical anymore. The mobile `ScanResult` carries `confidence`, `signals`, `flags`, and `explanation`, which match the v2 engine output. The backend's committed `ScanResult` still carries the older `recommendation` and `detailedAnalysis` fields. The extension models a signal as an object with `id`, `label`, `weight`, and `category`, while mobile treats `signals` as a plain string array. These are the same concept described four different ways.

Fix: a single `packages/types` that every app imports. One `ScanResult`, one `Signal`, one `RiskLevel`. When the engine output changes, it changes in one place and every client sees it.

### Supabase configuration
The project URL and anon key appear in several forms:

- `frontend/src/lib/supabase/config.ts` (from env)
- `mobile/lib/supabase.ts` (from `EXPO_PUBLIC_*` env)
- `extension/src/config.ts` (hardcoded string literals)

The extension version is a hardcoded credential in source. The anon key is public by design and protected by row level security, so this is not a leak in the dangerous sense, but hardcoding it means it cannot be rotated or pointed at a staging project without a code change. See `docs/security-review.md` for the security angle.

Fix: a single `packages/config` that reads the URL and key from environment, with one small helper per runtime (browser, React Native, extension) since the storage adapters differ.

### API client
Three separate clients do nearly the same job:

- `frontend/src/lib/api.ts` (axios, attaches the token, refreshes once on 401)
- `mobile/lib/api.ts` (axios, attaches the token, signs out on 401)
- `extension/src/api.ts` and `extension/src/auth.ts` (fetch, manual token refresh)

They differ in small ways that are probably accidental rather than intended. The mobile client hardcodes the backend URL. The extension keeps its own token lifecycle. The behavior on a 401 is different in each.

Fix: a `packages/sdk` with one client and clearly named methods (`scanMessage`, `scanUrl`, `getHistory`, `getProfile`, and so on). Each app injects its own token getter and base URL, and gets identical behavior for free.

### Risk labels and colors
`extension/src/config.ts` has `RISK_COLORS` and `RISK_LABELS`. The mobile app has its own in `mobile/constants/colors.ts`. The web app has its own styling. These drift the moment someone tweaks a shade.

Fix: move the shared risk vocabulary into `packages/config` or `packages/ui`, and let each app apply it in its own styling system.

## 2. Dependency cleanup

Each app manages its own dependencies today, which means duplicates and version skew are invisible until something breaks. The concrete actions:

- Once a workspace exists, hoist shared dependencies (React, TypeScript, Supabase client, Zod) to the root and pin one version each, so the web app and backend cannot drift to different Supabase client majors.
- Run a dead dependency check per app before the move (`npx depcheck` in each of `frontend`, `backend`, `mobile`, `extension`) and remove anything unused. This is safe to do per app right now, after the working tree is committed.
- Align the TypeScript and ESLint versions across apps so one shared config can serve all of them.

I did not remove any packages in this pass, because doing it on top of the uncommitted `package.json` and lockfile changes already in the tree would collide with your work. The `depcheck` step is quick to run once those are committed.

## 3. Dead code and artifacts

- `outputs/` holds two generated PDFs that are tracked in git. Generated files should not be committed. Remove them from tracking and add the folder to `.gitignore`:

  ```bash
  git rm --cached outputs/neural-shield-ai.pdf outputs/neural-shield-ai-detailed.pdf
  echo "outputs/" >> .gitignore
  ```

- `backend/dist`, `extension/dist`, `backend/logs`, and `backend/eng.traineddata` are already untracked, which is correct. Keep them that way. If any get added by accident during the move, they should stay ignored.
- The four package name values are inconsistent (`frontend`, `neural-shield-backend`, `neural-shield-ai`, `neural-shield-extension`). Rename them to a shared scope during the workspace step.

## 4. Backend internal structure

The backend is healthy and well layered already: routes call controllers, controllers call services and the engine, and the engine is cleanly separated into rules, collectors, intel, risk, and reputation. The requested split into `backend/{api,auth,ai,ml,threat-engine,services}` is mostly a rename and a move rather than a rewrite:

- `engine/` becomes `threat-engine/`
- `routes`, `controllers`, and `middleware` become `api/`
- `middleware/auth.middleware.ts` becomes `auth/`
- `services/ai.service.ts` becomes `ai/`
- the remaining services become `services/`
- `ml/` starts as a thin, empty home for the NSIE v3 model serving described in `docs/nsie/ml-architecture.md`

Because the backend deploys as a single Vercel function from `backend/api/index.ts`, this internal reshuffle needs the import paths and the entry file updated together, then a type check and the test suite run before it ships. It is low risk but it is not a no-op, so it belongs in the staged plan.

## 5. Suggested order

1. Commit or stash the current working tree so there is a clean base.
2. Apply the safe, local cleanups: the `outputs/` removal, the per app `depcheck`, and the package renames.
3. Introduce the workspace (`packages/*`) and move shared types, config, sdk, and validation into it, updating imports app by app with a type check after each.
4. Do the physical app move (`apps/*`) and the backend internal split, one target at a time, updating each deployment's settings as you go. This is the part that needs the manual dashboard changes in `docs/migration-guide.md`.
5. Run every app's build and the backend test suite at the end, and smoke test one real scan from each client.

None of this requires a big-bang change. Each step is small, reversible, and verifiable, which is the only responsible way to restructure something that is already live.
