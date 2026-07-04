-- Neural Shield AI — move scan-quota consumption into a SECURITY DEFINER function.
--
-- Problem: migration 0008 granted `authenticated` UPDATE on the scan-counter
-- columns so the backend (which runs under the user's JWT, no service role) could
-- meter usage. That also let a malicious client reset its own counters with a plain
-- UPDATE and scan without limit.
--
-- Fix: increment the counters atomically inside a SECURITY DEFINER function that
-- reads the caller's own row (`auth.uid()`), enforces the caps, and returns the
-- decision. Then revoke direct UPDATE on the counter columns from clients — only
-- this function may touch them. The Express backend calls the function via RPC and
-- keeps a read-modify-write fallback for the window before this migration is applied.

create or replace function public.app_consume_scan_quota(
  p_daily_limit integer,
  p_monthly_limit integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_daily_count integer;
  v_daily_reset timestamptz;
  v_monthly_count integer;
  v_monthly_reset timestamptz;
  v_day_expired boolean;
  v_month_expired boolean;
  v_day integer;
  v_month integer;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- Lock the caller's row for the read-modify-write so concurrent scans can't race
  -- past the cap.
  select daily_scan_count, daily_scan_reset_at, monthly_scan_count, monthly_scan_reset_at
    into v_daily_count, v_daily_reset, v_monthly_count, v_monthly_reset
    from public.profiles
   where id = v_uid
   for update;

  if not found then
    -- No profile row yet (should not happen post-signup trigger): allow, don't meter.
    return jsonb_build_object('allowed', true, 'reason', null);
  end if;

  v_day_expired := v_daily_reset is null or (v_now - v_daily_reset) >= interval '1 day';
  v_month_expired := v_monthly_reset is null or (v_now - v_monthly_reset) >= interval '30 days';
  v_day := case when v_day_expired then 0 else coalesce(v_daily_count, 0) end;
  v_month := case when v_month_expired then 0 else coalesce(v_monthly_count, 0) end;

  if p_daily_limit is not null and v_day >= p_daily_limit then
    return jsonb_build_object('allowed', false, 'reason', 'daily');
  end if;
  if p_monthly_limit is not null and v_month >= p_monthly_limit then
    return jsonb_build_object('allowed', false, 'reason', 'monthly');
  end if;

  update public.profiles
     set daily_scan_count = v_day + 1,
         daily_scan_reset_at = case when v_day_expired then v_now else daily_scan_reset_at end,
         monthly_scan_count = v_month + 1,
         monthly_scan_reset_at = case when v_month_expired then v_now else monthly_scan_reset_at end
   where id = v_uid;

  return jsonb_build_object('allowed', true, 'reason', null);
end;
$$;

revoke all on function public.app_consume_scan_quota(integer, integer) from public, anon;
grant execute on function public.app_consume_scan_quota(integer, integer) to authenticated;

-- Clients may no longer set their own scan counters directly; only the function
-- above (SECURITY DEFINER) can. Re-grant the genuinely user-editable columns.
revoke update on public.profiles from authenticated;
grant update (name, avatar_url, notification_prefs) on public.profiles to authenticated;
