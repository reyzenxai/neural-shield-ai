# Supabase Migration Reconciliation & Production DB Audit

> Date: 2026-07-05. Project: `jdcilinhabwilvbrjwjp` (ap-southeast-1, Postgres 17).
> Author: automated production audit. **Read this fully before running any command.**
> Everything in §3 (the runbook) is an **owner action** — no production-mutating command was run
> during this audit. Only read-only inspection (`SELECT`, `list_migrations`, `get_advisors`) was used.

---

## 1. What was actually wrong (verified against production)

The problem statement contained one incorrect premise, and the audit uncovered a more serious issue
than a naming mismatch:

1. **The remote ledger uses numeric versions, not timestamps.** `supabase_migrations.schema_migrations`
   contains exactly `0001`…`0013` (numeric). There are **no** timestamp-based migration IDs on this
   project. (The org also has a second project, `reyzen-website` — don't confuse the two.)

2. **`0013` is a GHOST migration — the single most important finding.** The ledger records `0013
   scan_quota_consume_function` as applied (with 5 statements stored), **but its DDL never took
   effect**:
   - `public.app_consume_scan_quota` **does not exist** in any schema.
   - The scan-counter columns (`daily_scan_count`, `monthly_scan_count`, and both `*_reset_at`) are
     **still granted** `UPDATE` to `authenticated`.
   This means the prior security hardening is **not live**: a user can still reset their own scan
   quota, and the backend is silently running its legacy read-modify-write fallback (which is why
   metering still appears to work). A ledger that claims applied while the schema disagrees is
   dangerous — it must be reconciled, not left.

3. **Duplicate migration version numbers.** Four version numbers had two files each:

   | Version | Recorded in remote ledger | Also present locally (unrecorded by name) |
   |---|---|---|
   | 0008 | `plans_v2_profiles` | `scan_signals` |
   | 0009 | `entity_intel` | `plan_memberships` |
   | 0010 | `payment_requests` | `reputation_engine` |
   | 0011 | `admin_role` | `plan_membership_functions` |

   These collisions are **not** Claude-generated. `git log` shows they were introduced by normal
   team development between 2026-06-21 and 2026-07-04 as two parallel tracks (an engine/"Week-N"
   track and a billing/"phase-N" track from the `pranjal-dev`/`ritik-dev` branches) that were merged
   with colliding prefixes. The only file added by the prior AI session was `0013`.

4. **All schema is present.** Every table (20) and every function from *both* halves of the
   duplicate pairs exists in production, and RLS is enabled on all 20 tables. The four
   "unrecorded" files are **fully idempotent** (`create … if not exists`, `create or replace`,
   `on conflict do nothing`, `drop … if exists`), so re-running them is a safe no-op.

**Diagnosis:** production schema is complete and correct **except** that the `0013` security fix
never actually ran. The migration *system* is blocked by (a) the ghost `0013` row and (b) duplicate
local filenames. No production **data** is at risk.

---

## 2. What was fixed in the repository (safe, local-only)

- The four unrecorded duplicate files were renamed to proper timestamp versions (their real commit
  timestamps), removing all duplicate version numbers. The ledger-matching file of each pair keeps
  its numeric name so it still matches the remote ledger exactly:

  | Renamed to | From |
  |---|---|
  | `20260621223913_scan_signals.sql` | `0008_scan_signals.sql` |
  | `20260623231857_reputation_engine.sql` | `0010_reputation_engine.sql` |
  | `20260703225415_plan_memberships.sql` | `0009_plan_memberships.sql` |
  | `20260704112236_plan_membership_functions.sql` | `0011_plan_membership_functions.sql` |

- After the rename, local `0001`…`0013` match the remote ledger by **both** version and name; the
  four timestamp files are new-but-idempotent.

No production command was run. The steps that touch production are in §3 for you to run.

---

## 3. Reconciliation runbook (OWNER ACTION — run in order)

> Pre-req: pull this branch so your local migrations directory has the renamed files. Confirm you
> are linked to the production project (`supabase link` / `supabase projects list` → `jdcilinhabwilvbrjwjp`).

### Step 0 — Inspect (read-only, no changes)
```bash
supabase migration list
```
You should see local `0001`–`0013` matching remote, plus the four timestamp files as **local-only
(not yet on remote)**, and `0013` present on both sides.

### Step 1 — Un-ghost `0013` (ledger-only; REQUIRED — justified)
```bash
supabase migration repair --status reverted 0013
```
**Why this is required (and why it's safe):** `0013` is recorded as applied but its DDL never ran
(verified: the function is absent and the grants are unchanged). `migration repair` is the *only*
official mechanism to correct the ledger. `--status reverted 0013` **deletes one bookkeeping row**
from `supabase_migrations.schema_migrations`. It does **not** run any SQL and does **not** touch any
user table, row, RLS policy, function, or trigger. After this, `0013` becomes "pending" so the next
push runs its real DDL.

### Step 2 — Apply the genuinely-pending migrations
```bash
supabase db push
```
Pending after Step 1 = `0013` (the real security fix) **plus** the four renamed timestamp files
(idempotent re-runs of already-applied schema). All pending versions sort *after* the last remote
migration (`0012`), so there is **no** "insert before last migration" error and **no** need for
`--include-all`. Expected: 5 migrations reported applied.

> **Do NOT use `supabase db push --include-all`.** It is unnecessary now, and in the original
> (pre-fix) state it would have tried to force-apply out-of-order files — some of `0001`–`0012` are
> not idempotent and would error or double-apply.

### Step 3 — Verify (read-only)
```bash
supabase migration list          # every local file has a matching remote row; no duplicates
```
Then confirm the `0013` DDL actually took effect (SQL editor or `psql`):
```sql
-- expect exactly one row:
select proname from pg_proc where proname = 'app_consume_scan_quota';

-- expect ONLY name, avatar_url, notification_prefs (NO *_scan_count / *_reset_at):
select column_name from information_schema.column_privileges
where table_schema='public' and table_name='profiles'
  and grantee='authenticated' and privilege_type='UPDATE'
order by column_name;
```
If the function exists and the counter columns are gone from that list, the security fix is live and
the migration system is clean.

### If `db push` still reports an out-of-order error
Run `supabase migration list` and compare. The most likely cause would be a *different* local file
whose version isn't on remote. Do not reach for `--include-all`; instead identify the specific file
and, if its SQL is already applied and idempotent, mark it applied with
`supabase migration repair --status applied <version>` (ledger-only) — and tell me the exact output
so I can advise precisely.

---

## 4. Broader production audit (Supabase advisors + inspection)

### 4.1 Security advisors

| Finding | Severity | Detail | Recommended action |
|---|---|---|---|
| Ghost `0013` (fix not applied) | **High** | `app_consume_scan_quota` missing; counter columns still client-updatable → self-service quota reset still possible. | §3 runbook applies it for real. |
| `function_search_path_mutable` | **Medium** | `public.handle_new_user` and `public.is_admin` are SECURITY DEFINER with **no** `search_path` set (search-path injection surface). | Set a locked search_path — but **review the body first** and schema-qualify all objects (esp. `handle_new_user`, a signup trigger; a wrong change breaks signups). |
| `anon` can execute SECURITY DEFINER functions | **Medium** (defense-in-depth) | 16 functions are `anon`-executable via `/rest/v1/rpc/*` (all `admin_*`, `is_admin`, `admin_is_admin`, `resolve_pending_members`, `app_effective_plan`, `app_link_member`, `app_unlink_member`, `app_submit_report`). **Not a live exploit** — each self-checks (`admin_is_admin()` → 42501, or `auth.uid()` null → raise). | Revoke `anon` EXECUTE (see §4.3). **Keep** `anon` on the intentional ones: `app_get_reputation`, `app_upsert_entity_intel`, `app_record_signals`, `app_record_api_scan`, `app_verify_api_key`, `app_subscribe` — revoking those **breaks the API-key/public paths**. |

### 4.2 Performance advisors

| Finding | Severity | Detail |
|---|---|---|
| `auth_rls_initplan` | Medium (at scale) | ~24 RLS policies call `auth.<fn>()` per-row instead of `(select auth.<fn>())`. Rewrite as `(select auth.uid())` for a big speedup at scale. Invasive (touches many policies) — do it deliberately with testing. |
| `unindexed_foreign_keys` | Low | Missing covering indexes on `feedback.scan_id`, `feedback.user_id`, `payment_requests.reviewed_by`, `urls.domain_id`. |
| `multiple_permissive_policies` | Low | `payment_requests`/`plan_memberships`/`profiles`/`scans` have 2 permissive policies for the same role+action (each is evaluated). Consider merging. |
| `unused_index` | Info | `scan_signals_signal_id`, `admin_logs_action_idx`, `entity_intel_expires_at` unused (likely just low data volume — don't drop yet). |

### 4.3 Optional hardening migration (apply AFTER §3 is confirmed working)

Create it deliberately as its own migration, review, then push. This is **safe** (admin/user
functions retain `authenticated`; only the unneeded `anon` grant is removed; FK indexes are additive):

```sql
-- harden_definer_grants_and_fk_indexes
-- Revoke anon EXECUTE from SECURITY DEFINER functions that are not part of the
-- public/API-key path (defense in depth; they already self-check).
revoke execute on function public.admin_get_stats() from anon;
revoke execute on function public.admin_get_users(integer,integer,text,text,text,text) from anon;
revoke execute on function public.admin_get_user(uuid) from anon;
revoke execute on function public.admin_get_scans(integer,integer,text,text,timestamptz,timestamptz,uuid) from anon;
revoke execute on function public.admin_get_feedback(integer,integer) from anon;
revoke execute on function public.admin_get_logs(integer,integer) from anon;
revoke execute on function public.admin_list_payments(text) from anon;
revoke execute on function public.admin_approve_payment(uuid) from anon;
revoke execute on function public.admin_reject_payment(uuid,text) from anon;
revoke execute on function public.admin_is_admin() from anon;
revoke execute on function public.is_admin() from anon;
revoke execute on function public.resolve_pending_members() from anon;
revoke execute on function public.app_effective_plan() from anon;
revoke execute on function public.app_link_member(integer,text) from anon;
revoke execute on function public.app_unlink_member(integer) from anon;
revoke execute on function public.app_submit_report(text,text,text,text) from anon;

-- Covering indexes for unindexed foreign keys.
create index if not exists feedback_scan_id_idx           on public.feedback (scan_id);
create index if not exists feedback_user_id_idx           on public.feedback (user_id);
create index if not exists payment_requests_reviewed_by_idx on public.payment_requests (reviewed_by);
create index if not exists urls_domain_id_idx             on public.urls (domain_id);
```
> Do **not** blanket-revoke `anon` from every SECURITY DEFINER function — the API-key and public
> reputation/subscribe paths depend on the `anon` grant.

### 4.4 Other production notes

- **Storage:** `payment-proofs` is private (correct). `avatars` is **public** — normal for profile
  images, but confirm it's intentional (public read of any avatar by URL).
- **Cron jobs:** none. `pg_cron`/`pg_net` are not installed; there are no scheduled DB jobs.
- **Extensions:** `pg_stat_statements`, `pgcrypto`, `uuid-ossp` only. Clean.
- **Edge functions:** `delete-account` and `razorpay-checkout` are ACTIVE with `verify_jwt=true`.
  The **deployed** `razorpay-checkout` predates the prior session's `PRICES` fix, so the live
  function still has the stale `business`/`pro` prices. It's inert (503, no secrets), but redeploy
  it (`supabase functions deploy razorpay-checkout`) before ever activating Razorpay.

---

## 5. Remaining risks

- **Until §3 is run:** the `0013` security fix is not live (self-service quota reset remains
  possible; metering still works via the backend fallback), and the ledger is dishonest about
  `0013`. **High** — run the runbook.
- **Fresh-reset ordering caveat (Medium, dev/DR only):** the four renamed files now sort *after*
  `0013` (timestamps > `00xx`). On a from-scratch `supabase db reset` (local dev / disaster
  recovery), migrations that reference `scans.risk_score`/`scan_signals`/reputation tables could run
  before those objects are created. This does not affect production (never reset). The proper
  long-term fix is a **squashed baseline** migration reflecting current prod schema — do it when you
  have a maintenance window.
- **DB hardening (Medium):** mutable `search_path` on 2 functions and `anon`-executable definer
  functions (§4.1) remain until you apply §4.3 + review `handle_new_user`.
- **Deployed razorpay stale prices (Low):** inert until secrets are set; redeploy before activating.
```
