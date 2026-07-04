-- Neural Shield AI — DB security-advisor hardening (part 2).
-- Applied to production via MCP on 2026-07-04; mirrored here so repo = ledger.
--
-- The prior migration revoked EXECUTE from `anon` directly, but these functions hold
-- EXECUTE via the PUBLIC pseudo-role, so it was a no-op. Revoke from PUBLIC and
-- re-grant only to `authenticated` (admins call them with a signed-in JWT; each
-- function also self-checks admin_is_admin() and raises 42501 for non-admins).
-- The public/API-key functions (app_get_reputation, app_verify_api_key,
-- app_record_signals, app_record_api_scan, app_upsert_entity_intel, app_subscribe)
-- are intentionally left executable by anon and are NOT touched here.
revoke execute on function public.admin_get_stats() from public;
grant execute on function public.admin_get_stats() to authenticated;
revoke execute on function public.admin_get_users(integer,integer,text,text,text,text) from public;
grant execute on function public.admin_get_users(integer,integer,text,text,text,text) to authenticated;
revoke execute on function public.admin_get_user(uuid) from public;
grant execute on function public.admin_get_user(uuid) to authenticated;
revoke execute on function public.admin_get_scans(integer,integer,text,text,timestamptz,timestamptz,uuid) from public;
grant execute on function public.admin_get_scans(integer,integer,text,text,timestamptz,timestamptz,uuid) to authenticated;
revoke execute on function public.admin_get_feedback(integer,integer) from public;
grant execute on function public.admin_get_feedback(integer,integer) to authenticated;
revoke execute on function public.admin_get_logs(integer,integer) from public;
grant execute on function public.admin_get_logs(integer,integer) to authenticated;
revoke execute on function public.admin_list_payments(text) from public;
grant execute on function public.admin_list_payments(text) to authenticated;
revoke execute on function public.admin_approve_payment(uuid) from public;
grant execute on function public.admin_approve_payment(uuid) to authenticated;
revoke execute on function public.admin_reject_payment(uuid,text) from public;
grant execute on function public.admin_reject_payment(uuid,text) to authenticated;
revoke execute on function public.admin_is_admin() from public;
grant execute on function public.admin_is_admin() to authenticated;
revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
-- Trigger helper: not meant to be called directly via the REST API by anyone.
revoke execute on function public.resolve_pending_members() from public;
