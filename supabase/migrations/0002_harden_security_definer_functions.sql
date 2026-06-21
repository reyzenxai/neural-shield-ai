-- Neural Shield AI — harden SECURITY DEFINER functions (decision D2 follow-up)
-- Mirrors live migration 20260620140358.

-- Pin search_path on the updated_at trigger function (defence against search_path hijack).
alter function public.set_updated_at() set search_path = '';

-- handle_new_user is meant to run only from the auth.users trigger, never as an
-- RPC. Revoke EXECUTE from API roles so it is not callable via /rest/v1/rpc.
revoke execute on function public.handle_new_user() from anon, authenticated, public;
