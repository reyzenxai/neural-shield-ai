-- Neural Shield AI — DB security-advisor hardening (part 1).
-- Applied to production via MCP on 2026-07-04; mirrored here so repo = ledger.
--
-- NOTE: the anon revokes below are a no-op because these functions hold EXECUTE via
-- the PUBLIC pseudo-role, not a direct anon grant. The effective revoke is done in
-- 20260704225802_harden_definer_grants_public_revoke.sql (revoke from PUBLIC + grant
-- authenticated). This file is kept for ledger fidelity; the search_path locks below
-- are the meaningful change here.
revoke execute on function public.admin_get_stats() from anon;
revoke execute on function public.admin_get_users(integer,integer,text,text,text,text) from anon;
revoke execute on function public.admin_get_user(uuid) from anon;
revoke execute on function public.admin_get_scans(integer,integer,text,text,timestamptz,timestamptz,uuid) from anon;
revoke execute on function public.admin_get_feedback(integer,integer) from anon;
revoke execute on function public.admin_get_logs(integer,integer) from anon;
revoke execute on function public.admin_is_admin() from anon;
revoke execute on function public.is_admin() from anon;
revoke execute on function public.resolve_pending_members() from anon;

-- Pin search_path on the two functions the security advisor flagged as mutable
-- (behavior-preserving: both already resolve their objects in the public schema).
alter function public.handle_new_user() set search_path = public;
alter function public.is_admin() set search_path = public;
