-- Neural Shield AI — Trust Engine v2, Week 1 (evidence trail)
-- See docs/reputation-database.md and docs/implementation-prompt.md (Week 1).
--
-- This is the Week-1 SLICE of the reputation schema: it adds the per-scan evidence
-- trail (scan_signals) and the new traceability columns on scans. The shared
-- reputation tables (domains/urls/emails/phone_numbers/upi_ids/reports/threat_sources/
-- entity_intel) + their write RPCs land in a Week-3 migration (0009). Migrations are
-- immutable once applied, so the spec's single 0008_reputation_engine.sql is split.
--
-- scan_signals is PER-USER data (the evidence behind a user's own scan), so it is
-- RLS-scoped to the parent scan's owner — same pattern as scan_flags (0001). Shared,
-- cross-user reputation tables will instead be write-via-SECURITY-DEFINER-RPC.

-- ---------------------------------------------------------------------------
-- new traceability columns on scans
-- ---------------------------------------------------------------------------
alter table public.scans add column if not exists risk_score integer;
alter table public.scans add column if not exists confidence double precision;
alter table public.scans add column if not exists engine_version text;
alter table public.scans add column if not exists primary_entity_type text
  check (primary_entity_type in ('url','domain','email','phone','upi','ip','text'));
alter table public.scans add column if not exists primary_entity_id uuid;

-- ---------------------------------------------------------------------------
-- scan_signals — one row per signal per scan (the audit trail)
-- ---------------------------------------------------------------------------
create table if not exists public.scan_signals (
  id uuid primary key default uuid_generate_v4(),
  scan_id uuid not null references public.scans (id) on delete cascade,
  signal_id text not null,                 -- e.g. 'domain.age_lt_30d', 'ti.phishtank.verified'
  category text not null,
  weight numeric not null,
  confidence numeric not null,
  source_tier smallint not null,
  source text not null,                    -- SourceId string (FK to threat_sources added in 0009)
  override text check (override in ('malicious','allowlist')),
  evidence jsonb,
  created_at timestamptz not null default now()
);

create index if not exists scan_signals_scan_id on public.scan_signals (scan_id);
create index if not exists scan_signals_signal_id on public.scan_signals (signal_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row-Level Security — owned via the parent scan (mirrors scan_flags)
-- ---------------------------------------------------------------------------
alter table public.scan_signals enable row level security;

drop policy if exists "scan_signals_via_scans" on public.scan_signals;
create policy "scan_signals_via_scans" on public.scan_signals
  for all using (
    exists (select 1 from public.scans s where s.id = scan_signals.scan_id and s.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.scans s where s.id = scan_signals.scan_id and s.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- app_record_signals — record evidence for an API-key scan (definer, key-gated)
-- Mirrors app_record_api_scan (0005): the web app inserts under RLS directly; the
-- Business API path has no JWT, so it uses this RPC gated by API-key possession.
-- ---------------------------------------------------------------------------
create or replace function public.app_record_signals(
  p_hash text,
  p_scan_id uuid,
  p_signals jsonb
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_user uuid; v_owner uuid; v_count integer := 0; s jsonb;
begin
  select k.user_id into v_user
  from public.api_keys k
  where k.key_hash = p_hash and k.revoked_at is null
  limit 1;

  if v_user is null then
    raise exception 'invalid_api_key';
  end if;

  -- The scan must belong to the key owner.
  select sc.user_id into v_owner from public.scans sc where sc.id = p_scan_id;
  if v_owner is null or v_owner <> v_user then
    raise exception 'scan_not_owned';
  end if;

  if p_signals is not null then
    for s in select * from pg_catalog.jsonb_array_elements(p_signals) loop
      insert into public.scan_signals (
        scan_id, signal_id, category, weight, confidence, source_tier, source, override, evidence
      ) values (
        p_scan_id,
        s->>'id',
        s->>'category',
        (s->>'weight')::numeric,
        (s->>'confidence')::numeric,
        (s->>'sourceTier')::smallint,
        s->>'source',
        s->>'override',
        s->'evidence'
      );
      v_count := v_count + 1;
    end loop;
  end if;

  return v_count;
end;
$$;

revoke all on function public.app_record_signals(text, uuid, jsonb) from public;
grant execute on function public.app_record_signals(text, uuid, jsonb) to anon, authenticated;
