# Migration Guide

How to turn the current repository into the monorepo described in `docs/folder-structure.md` without taking any of the live apps offline. This is written as an ordered runbook. Each phase is small, testable, and reversible, and the phases are arranged so that the risky, deployment-touching work comes last, after all the value has already been captured.

## Principles

- Commit or stash before touching anything, so every step has a clean base and a clean diff.
- Do one app or one package at a time, and run its build or type check before moving on.
- Keep the deployment-critical folders in place until the very end, and change the deploy settings in the same phase you move them, never before.
- Prefer many small commits over one big one, so a rollback is a `git revert`, not an archaeology project.

## The order at a glance

1. Secure the working tree.
2. Add a workspace at the root, with the apps left exactly where they are.
3. Extract shared packages (`types`, `config`, `sdk`, `validation`, `ui`) and wire each app to them.
4. Reorganize the backend internally (`engine` to `threat-engine`, and so on).
5. Move the apps into `apps/*`, move `supabase` to `database`, gather config into `infrastructure`, and update every deployment setting.

The important idea is that phases 2 and 3 deliver most of the real benefit, which is one source of truth for shared code, and they do not move a single deployment folder. Phase 5, the physical move, is mostly cosmetic by comparison, and it is the only phase that needs the manual dashboard changes.

## Phase 0: secure the working tree

There are uncommitted changes right now. Do not start until they are saved.

```bash
git checkout -b chore/pre-monorepo-snapshot
git add -A
git commit -m "snapshot before monorepo migration"
```

If you would rather not commit the in-progress work yet, stash it with `git stash -u`, but a commit on a throwaway branch is safer because nothing can be lost.

## Phase 1: add a workspace, keep folders in place

Create a root `package.json` that declares the workspace. npm workspaces are the least surprising choice and need no extra tooling, though pnpm or Turborepo work too.

```json
{
  "name": "neural-shield",
  "private": true,
  "workspaces": ["frontend", "backend", "mobile", "extension", "packages/*"]
}
```

At this point nothing has moved. The apps are still at `frontend`, `backend`, `mobile`, and `extension`. Install once at the root and confirm every app still builds:

```bash
npm install
(cd frontend && npm run build)
(cd backend && npm run type-check && npm test && npm run build)
(cd extension && node build.mjs)
```

Deployment note: Vercel detects an npm workspace and installs from the root, so the web and backend projects keep working with their current root directories. Confirm this with a preview deploy before you rely on it. React Native and Metro can be sensitive to a hoisted `node_modules`, so if the mobile app misbehaves after this step, add an `.npmrc` in `mobile/` with `node-linker=hoisted` disabled, or keep the mobile app out of the workspace until Phase 5. The mobile app already has an `.npmrc`, so check its settings first.

## Phase 2: shared types first

This is the highest value change and it fixes the drift documented in `docs/refactoring-report.md`.

1. Create `packages/types` with its own `package.json` (name `@neural-shield/types`) and a single `index.ts`.
2. Define the canonical `ScanType`, `RiskLevel`, `Plan`, `Signal`, `ScanResult`, `Profile`, and the admin types once. Use the v2 engine shape, since that is what the clients already expect: `confidence`, `signals`, `flags`, `explanation`.
3. Wire one app at a time. Replace the local type file's contents with a re-export from `@neural-shield/types`, run that app's type check, and fix the mismatches it surfaces. Do the backend last, because aligning it will reveal the places where the committed backend types are still on the old shape.

Commit after each app so a regression is easy to bisect.

## Phase 3: config, sdk, validation, ui

Same pattern, one package at a time, one consumer at a time.

- `packages/config`: the Supabase URL and anon key from environment, the API base URLs, and the risk labels and colors. Provide a small per-runtime helper for the browser, React Native, and the extension, because the storage adapters differ. Remove the hardcoded values from `extension/src/config.ts`, `mobile/eas.json` stays as build env, and `mobile/lib/api.ts` reads the URL from config.
- `packages/sdk`: one API client with named methods, where each app injects its base URL and a token getter. Replace `frontend/src/lib/api.ts`, `mobile/lib/api.ts`, and `extension/src/api.ts` with thin wrappers around it.
- `packages/validation`: move the backend Zod schemas here so the clients can validate before sending.
- `packages/ui`: shared design tokens and any components that genuinely make sense across web and the extension options page. Do not force React Native to share web components; keep this package small and honest.

After each package, run the type check and build for every app that consumes it.

## Phase 4: reorganize the backend internally

This is a move and a rename, not a rewrite. Do it in one focused branch.

- `backend/src/engine` becomes `backend/threat-engine`.
- `backend/src/{routes,controllers,middleware}` becomes `backend/api`.
- `backend/src/middleware/auth.middleware.ts` becomes `backend/auth`.
- `backend/src/services/ai.service.ts` becomes `backend/ai`.
- the remaining services become `backend/services`.
- add an empty `backend/ml` with a short README pointing at `docs/nsie/ml-architecture.md`.

Update the import paths, update the serverless entry at `backend/api/index.ts`, then run `npm run type-check`, `npm test`, and `npm run build`. Do not ship until all three are green. Because the backend deploys as a single function, keep its top level `backend/` folder where it is so the Vercel root directory does not change in this phase.

## Phase 5: the physical app move (needs manual dashboard changes)

This is the only phase that can take a build offline, so it goes last and each move is paired with its settings change.

### 5a. Move the folders with git so history follows

```bash
mkdir apps
git mv frontend apps/web
git mv mobile apps/android
git mv extension apps/extension
git mv supabase database
```

Update the root `package.json` workspaces to `["apps/*", "backend", "packages/*"]`, update CI working directories in `.github/workflows`, and update any script that `cd`s into the old paths.

### 5b. Web app on Vercel (manual)

I cannot change these settings, because the Vercel projects are not in an account I can reach. You will need to:

1. Open the Vercel dashboard, select the web project.
2. Go to Settings, then General, then Root Directory.
3. Change it from `frontend` to `apps/web` and save.
4. Redeploy and confirm the build succeeds and the site loads.

If the backend project's folder also moves in your plan, repeat the same for it. In the structure here the backend stays at `backend/`, so its root directory does not change.

### 5c. Android app on EAS (manual)

EAS builds from the app directory, so moving `mobile` to `apps/android` means every EAS command and any CI step must run from the new path.

1. Run `eas build` from `apps/android` rather than `mobile`.
2. Update any CI or scripts that `cd mobile` to `cd apps/android`.
3. The `eas.json` and `app.json` move with the folder, so their contents do not change, but confirm the `EXPO_PUBLIC_*` env values are still present in each build profile.
4. Run a development build first, then a preview build, before touching the production channel.

### 5d. Chrome extension (manual for the store, local for the build)

1. Update `extension/build.mjs` output paths if they assume the old location, then run it from `apps/extension` and confirm `dist/` is produced.
2. Load the unpacked `dist/` in Chrome and verify the popup, content script, and options page work against the backend.
3. For a store release, zip `apps/extension/dist` and upload it in the Chrome Web Store developer dashboard. The store submission itself is always manual, and the broad host permissions in `docs/security-review.md` will be reviewed, so have the justification ready.

### 5e. Supabase and infrastructure

1. Moving `supabase` to `database` does not affect the hosted project, since Supabase links by project reference, not by folder. Update your local `supabase` CLI working directory and any script paths.
2. Gather the Docker, Vercel, Railway, and CI config into `infrastructure/` as a final tidy-up, updating references as you move each file. Do this last and one file at a time.

## Verification checklist

Run this at the end of every phase, and in full at the very end.

- `npm run type-check` passes in every app.
- `npm test` passes in the backend.
- `npm run build` succeeds in the web app, backend, and extension.
- A development EAS build of the Android app succeeds.
- One real scan works end to end from each client: web, Android, and the extension.
- The admin routes still reject a non-admin user.

## Rollback

Because each phase is its own set of commits, a rollback is a `git revert` of that phase's commits, followed by re-running the verification checklist. The only phase where a revert is not enough on its own is Phase 5, because the deploy settings changed in a dashboard. If you revert the folder move, change the Vercel root directory and the EAS paths back in the same session, so the code and the settings never disagree.

## Why it is worth doing this way

A big-bang restructure of a live, three-client product is the kind of change that looks fast and then costs a week of firefighting when a deploy setting quietly points at a folder that no longer exists. Staged the way it is here, the shared-code work that actually improves the codebase lands first and safely, and the folder move at the end is a short, well-rehearsed step with its settings changes attached. Nothing is skipped, and nothing goes dark.
