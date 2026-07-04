-- Neural Shield AI — single active device per account.
-- Applied to production via MCP on 2026-07-04; mirrored here so repo = ledger.
--
-- The web client stores a per-browser device id and calls app_claim_active_device on
-- login (newest login wins). Other devices detect that profiles.active_device_id no
-- longer matches their own id (on load or tab focus) and sign themselves out.
alter table public.profiles add column if not exists active_device_id text;

create or replace function public.app_claim_active_device(p_device_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  update public.profiles set active_device_id = p_device_id where id = auth.uid();
end;
$$;

revoke all on function public.app_claim_active_device(text) from public, anon;
grant execute on function public.app_claim_active_device(text) to authenticated;
