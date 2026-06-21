-- Neural Shield AI — API-key auth RPCs (decision D9)
-- Mirrors live migration 20260620183434.
--
-- The backend is RLS-only (no service-role key). To authenticate Business API
-- keys and persist their scans it calls these two SECURITY DEFINER RPCs. Each
-- re-verifies the key hash internally, so possession of the key is the
-- authorization. search_path is locked to '' and all schema refs are qualified.

-- Verify an API key by its SHA-256 hash. Returns the owner + plan and stamps
-- last_used_at. Safe to expose to anon: possessing the key hash IS the auth.
create or replace function public.app_verify_api_key(p_hash text)
returns table(user_id uuid, email text, plan text)
language plpgsql
security definer
set search_path = ''
as $$
declare v_key_id uuid; v_user uuid;
begin
  select k.id, k.user_id into v_key_id, v_user
  from public.api_keys k
  where k.key_hash = p_hash and k.revoked_at is null
  limit 1;

  if v_key_id is null then
    return;
  end if;

  update public.api_keys set last_used_at = pg_catalog.now() where id = v_key_id;

  return query
    select p.id, p.email, p.plan from public.profiles p where p.id = v_user;
end;
$$;

revoke all on function public.app_verify_api_key(text) from public;
grant execute on function public.app_verify_api_key(text) to anon, authenticated;

-- Record a scan (+ flags) on behalf of an API key's owner. Re-verifies the key
-- inside, so the privileged insert is gated by key possession.
create or replace function public.app_record_api_scan(
  p_hash text,
  p_scan_type text,
  p_input_text text,
  p_input_url text,
  p_scam_probability double precision,
  p_trust_score integer,
  p_risk_level text,
  p_scam_type text,
  p_ai_model text,
  p_processing_time_ms integer,
  p_flags jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_user uuid; v_scan_id uuid; f jsonb;
begin
  select k.user_id into v_user
  from public.api_keys k
  where k.key_hash = p_hash and k.revoked_at is null
  limit 1;

  if v_user is null then
    raise exception 'invalid_api_key';
  end if;

  insert into public.scans (
    user_id, scan_type, input_text, input_url, scam_probability,
    trust_score, risk_level, scam_type, ai_model, processing_time_ms
  ) values (
    v_user, p_scan_type, p_input_text, p_input_url, p_scam_probability,
    p_trust_score, p_risk_level, p_scam_type, p_ai_model, p_processing_time_ms
  ) returning id into v_scan_id;

  if p_flags is not null then
    for f in select * from pg_catalog.jsonb_array_elements(p_flags) loop
      insert into public.scan_flags (scan_id, flag, severity, description)
      values (v_scan_id, f->>'flag', f->>'severity', f->>'description');
    end loop;
  end if;

  return v_scan_id;
end;
$$;

revoke all on function public.app_record_api_scan(text, text, text, text, double precision, integer, text, text, text, integer, jsonb) from public;
grant execute on function public.app_record_api_scan(text, text, text, text, double precision, integer, text, text, text, integer, jsonb) to anon, authenticated;
