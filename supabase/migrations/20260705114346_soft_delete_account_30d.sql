-- Neural Shield AI — 30-day soft delete for accounts.
-- Applied to production via MCP on 2026-07-05; mirrored here so repo = ledger.
--
-- "Delete account" now marks profiles.deleted_at and signs the user out, keeping ALL
-- data (scans, plan, counters). Logging in within 30 days restores the account with its
-- history intact; after 30 days the client purges it via the delete-account edge function.
alter table public.profiles add column if not exists deleted_at timestamptz;

create or replace function public.app_soft_delete_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  update public.profiles set deleted_at = now() where id = auth.uid();
end; $$;
revoke all on function public.app_soft_delete_account() from public, anon;
grant execute on function public.app_soft_delete_account() to authenticated;

create or replace function public.app_restore_account()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_deleted timestamptz;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select deleted_at into v_deleted from public.profiles where id = auth.uid();
  if v_deleted is null then return jsonb_build_object('status', 'active'); end if;
  if v_deleted > now() - interval '30 days' then
    update public.profiles set deleted_at = null where id = auth.uid();
    return jsonb_build_object('status', 'restored');
  end if;
  return jsonb_build_object('status', 'expired');
end; $$;
revoke all on function public.app_restore_account() from public, anon;
grant execute on function public.app_restore_account() to authenticated;
