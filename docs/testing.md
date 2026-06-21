# Testing — Neural Shield AI

## Strategy

A pragmatic pyramid focused where the risk actually lives — the backend analysis/validation
logic and the database boundary (RLS). The frontend logic is thin (most data flows through
typed services + RLS), so it is covered by type-checking, lint, and a green production build,
with E2E recommended as a follow-up.

| Layer | Tooling | Status |
| --- | --- | --- |
| Backend unit (pure logic) | `node:test` + `tsx` | ✅ added (`tests/ai.test.ts`, `tests/schemas.test.ts`) |
| Backend API/integration | `node:test` + Express + `fetch` | ✅ added (`tests/api.test.ts`) |
| Static analysis | `tsc --noEmit`, ESLint (flat config) | ✅ green both apps |
| Build verification | `next build`, `tsc` (backend) | ✅ green both apps |
| Frontend E2E | Playwright | ⬜ recommended follow-up |

> We deliberately use Node 20's **built-in test runner** (zero new dependencies) instead of
> Jest/Supertest. It runs `.ts` directly via `tsx`, starts fast, and emits TAP for CI. If the
> suite grows toward broad component/E2E coverage, add Vitest (frontend) + Playwright (E2E).

## Current suite (25 tests, all passing)

```
backend/tests/
├─ ai.test.ts        clampNumber, extractJson (fences/prose/garbage), normalize
│                    (enum fallback, clamping, flag filtering, defaults)
├─ schemas.test.ts   Message/Url/Email/Phone/Upi Zod schemas — valid + invalid + transforms
└─ api.test.ts       boots the Express app on an ephemeral port:
                     GET /api/health → 200 + envelope, helmet headers present,
                     unknown route → 404 error envelope
```

Run:

```bash
cd backend
npm test            # node --import tsx --test tests/*.test.ts  → TAP, exits non-zero on failure
```

The `api.test.ts` smoke test is intentionally **auth-independent** (health + 404) so it is
deterministic regardless of whether a local `.env` is present.

## What the tests assert (highlights)

- **AI normalization is bullet-proof**: any malformed model output is coerced to a valid
  `ScanResult` shape (the client can never receive garbage).
- **Validation is correct**: HTML is stripped, phone numbers normalized, UPI lowercased,
  length bounds enforced; bad inputs are rejected before reaching the AI.
- **The middleware stack is wired**: helmet sets `x-content-type-options: nosniff` + a CSP;
  unmatched routes return the standard error envelope.

## Recommended next tests (follow-up, not blocking)

1. **API authz matrix** (Supertest or `fetch` with a seeded Supabase test project): JWT
   required → 401; free user over daily cap → 429; non-pro on `/screenshot` → 403; non-business
   API key → 403.
2. **RLS contract tests** (pgTAP or SQL): user A cannot read/insert user B's scans;
   `plan` UPDATE by a user → `42501`.
3. **Frontend E2E** (Playwright): signup → login → run a scan → see it in history → CSV export
   → delete; route-guard redirects.
4. **Edge function tests** (Deno test): Razorpay HMAC verification accepts a correct signature
   and rejects a tampered one.

## Coverage

`node --test --experimental-test-coverage` produces a coverage summary. A formal coverage gate
(e.g. ≥80% on `services/` + `schemas/`) is a good CI addition once the authz/RLS tests land.
Today's suite targets the highest-risk pure logic and the HTTP envelope; the AI network call,
RLS, and edge functions are validated by the manual live verifications recorded in
`DECISIONS.md`.
