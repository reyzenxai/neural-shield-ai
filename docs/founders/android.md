# Android / Mobile App

> **Priority 3** (the website is the launch product). The mobile app exists and shares the backend,
> but is not the current focus. Expo ~54 / React Native 0.81, Android-first, expo-router.
> ⚠️ It has known contract drift vs. the current backend — see the bugs section.

## What it is

An Expo / React Native app that talks to the same Express backend and Supabase project as the
website. Tokens are stored in `expo-secure-store`. History and profile read directly from Supabase
under RLS; scans go through the backend; admin screens call the admin API.

## Structure

- Navigation (`app/`): `index` (gate), `(auth)/{login,signup}`, `(tabs)/{home,scan,history,
  profile}`, `result`, `onboarding`, `phone-setup`, `permissions-setup`, `privacy-policy`, `terms`,
  `admin`.
- Auth: `hooks/useAuth.ts`, `lib/supabase.ts` (Supabase + SecureStore; 401 → sign out).
- API: `lib/api.ts` (axios to the prod backend, token attached; `scanContent` JSON, `scanImage`
  multipart).
- State: React Query + Zustand (`lib/store.ts`).
- UI: custom components (`components/ui/*`), tokens in `constants/colors.ts`, design system in
  `mobile/docs/ui-design-system.md`.
- Build: `eas.json` (EAS Build), `app.json` (Expo config).

## Security

- Tokens in SecureStore (encrypted OS keystore).
- The Supabase anon key in `eas.json` is public and RLS-safe.
- ⚠️ **Read `mobile/AGENTS.md`** before editing — Expo has breaking changes; read the versioned docs.

## Known contract drift (Priority 3 backlog — not website blockers)

1. **Image field mismatch:** `scanImage` sends form field `image`, but the backend expects `file`
   → "No image uploaded" (also Pro-gated, so free users hit 403 first).
2. **Feedback shape mismatch:** `submitFeedback` posts `{ scanId, isAccurate, comment }` to
   `/api/report`, which requires `{ entityType, entityValue, reportType }` → 400.
3. **Free-plan limit drift:** mobile shows 5/day; the backend enforces 10/day.
4. **Reads columns not in tracked migrations** (`scans.signals/flags/explanation`, `profiles.phone`)
   — works only if the live DB added them out-of-band.

These are documented in `../../context.md` §24. Fix them when the mobile workstream resumes; align
the mobile client with the shared `@neural-shield/sdk` to prevent future drift.

## Recommended hardening when mobile becomes a priority
- Certificate pinning, root/tamper detection, secure networking review.
- Adopt `@neural-shield/sdk` so the scan contract can't drift from the backend.
- Reconcile the schema columns (add real migrations or stop reading them).
