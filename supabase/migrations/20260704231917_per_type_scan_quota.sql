-- Neural Shield AI — per-scanner-type daily quota (paid plans).
-- Applied to production via MCP on 2026-07-04; mirrored here so repo = ledger.
--
-- Free keeps the single daily counter on profiles (app_consume_scan_quota). Paid
-- plans meter each scanner type separately (individual 30, two_person 22, family 15
-- per scanner per day). Monthly caps are dropped.
create table if not exists public.scan_quota_usage (
  user_id    uuid not null references auth.users (id) on delete cascade,
  scan_type  text not null,
  usage_date date not null default current_date,
  count      integer not null default 0,
  primary key (user_id, scan_type, usage_date)
);

alter table public.scan_quota_usage enable row level security;
drop policy if exists scan_quota_usage_own on public.scan_quota_usage;
create policy scan_quota_usage_own on public.scan_quota_usage
  for select using (user_id = auth.uid());
-- No direct client writes: only the SECURITY DEFINER function below mutates counts.

create or replace function public.app_consume_scan_quota_by_type(
  p_scan_type   text,
  p_daily_limit integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_new_count integer;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  insert into public.scan_quota_usage (user_id, scan_type, usage_date, count)
    values (v_uid, p_scan_type, current_date, 1)
  on conflict (user_id, scan_type, usage_date)
    do update set count = public.scan_quota_usage.count + 1
  returning count into v_new_count;

  if p_daily_limit is not null and v_new_count > p_daily_limit then
    update public.scan_quota_usage set count = count - 1
     where user_id = v_uid and scan_type = p_scan_type and usage_date = current_date;
    return jsonb_build_object('allowed', false, 'reason', 'daily_type');
  end if;

  return jsonb_build_object('allowed', true, 'reason', null);
end;
$$;

revoke all on function public.app_consume_scan_quota_by_type(text, integer) from public, anon;
grant execute on function public.app_consume_scan_quota_by_type(text, integer) to authenticated;
