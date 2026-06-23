-- Neural Shield AI — Trust Engine v2, Week 3 (reputation engine)
-- Creates: threat_sources (seeded), domains, urls, emails, phone_numbers, upi_ids, reports
-- RPCs:    app_submit_report, app_upsert_entity_intel, app_get_reputation

-- ---------------------------------------------------------------------------
-- threat_sources — canonical registry of intelligence sources (read-only)
-- ---------------------------------------------------------------------------
create table if not exists public.threat_sources (
  id   text primary key,
  name text not null,
  tier smallint not null check (tier in (1, 2, 3)),
  type text not null check (type in ('blocklist', 'rdap', 'tls', 'community', 'rule')),
  url  text,
  notes text
);

insert into public.threat_sources (id, name, tier, type, url) values
  ('gsb',         'Google Safe Browsing',  1, 'blocklist', 'https://safebrowsing.googleapis.com'),
  ('urlhaus',     'URLHaus',               1, 'blocklist', 'https://urlhaus-api.abuse.ch'),
  ('phishtank',   'PhishTank',             1, 'blocklist', 'https://www.phishtank.com'),
  ('openphish',   'OpenPhish',             1, 'blocklist', 'https://openphish.com'),
  ('rdap',        'RDAP (IANA)',           1, 'rdap',      'https://rdap.org'),
  ('tls',         'TLS Certificate',       1, 'tls',       null),
  ('dns',         'DNS Resolver',          1, 'rdap',      null),
  ('structural',  'Structural Heuristics', 3, 'rule',      null),
  ('rule_engine', 'Rule Engine',           3, 'rule',      null),
  ('reputation_db','Community Reputation', 2, 'community', null)
on conflict (id) do nothing;

alter table public.threat_sources enable row level security;
drop policy if exists "threat_sources_public_read" on public.threat_sources;
create policy "threat_sources_public_read" on public.threat_sources for select using (true);

-- ---------------------------------------------------------------------------
-- entity tables — shared reputation state (public-read; writes via RPC only)
-- ---------------------------------------------------------------------------
create table if not exists public.domains (
  id                 uuid primary key default uuid_generate_v4(),
  registrable_domain text not null unique,
  first_seen_at      timestamptz not null default now(),
  last_seen_at       timestamptz not null default now(),
  report_count       integer not null default 0,
  reputation_score   numeric check (reputation_score between 0 and 100),
  updated_at         timestamptz not null default now()
);
create table if not exists public.urls (
  id               uuid primary key default uuid_generate_v4(),
  url              text not null unique,
  domain_id        uuid references public.domains (id),
  first_seen_at    timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  report_count     integer not null default 0,
  reputation_score numeric check (reputation_score between 0 and 100),
  updated_at       timestamptz not null default now()
);
create table if not exists public.emails (
  id               uuid primary key default uuid_generate_v4(),
  email            text not null unique,
  first_seen_at    timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  report_count     integer not null default 0,
  reputation_score numeric check (reputation_score between 0 and 100),
  updated_at       timestamptz not null default now()
);
create table if not exists public.phone_numbers (
  id               uuid primary key default uuid_generate_v4(),
  e164             text not null unique,
  first_seen_at    timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  report_count     integer not null default 0,
  reputation_score numeric check (reputation_score between 0 and 100),
  updated_at       timestamptz not null default now()
);
create table if not exists public.upi_ids (
  id               uuid primary key default uuid_generate_v4(),
  vpa              text not null unique,
  first_seen_at    timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  report_count     integer not null default 0,
  reputation_score numeric check (reputation_score between 0 and 100),
  updated_at       timestamptz not null default now()
);

-- RLS on entity tables (public-read, no direct writes)
do $$ begin
  alter table public.domains       enable row level security;
  alter table public.urls          enable row level security;
  alter table public.emails        enable row level security;
  alter table public.phone_numbers enable row level security;
  alter table public.upi_ids       enable row level security;
exception when others then null; end $$;

drop policy if exists "domains_public_read"       on public.domains;
drop policy if exists "urls_public_read"          on public.urls;
drop policy if exists "emails_public_read"        on public.emails;
drop policy if exists "phone_numbers_public_read" on public.phone_numbers;
drop policy if exists "upi_ids_public_read"       on public.upi_ids;
create policy "domains_public_read"       on public.domains       for select using (true);
create policy "urls_public_read"          on public.urls          for select using (true);
create policy "emails_public_read"        on public.emails        for select using (true);
create policy "phone_numbers_public_read" on public.phone_numbers for select using (true);
create policy "upi_ids_public_read"       on public.upi_ids       for select using (true);

-- ---------------------------------------------------------------------------
-- reports — user-submitted scam reports (RLS: owner-only)
-- ---------------------------------------------------------------------------
create table if not exists public.reports (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  entity_type  text not null
    check (entity_type in ('url','domain','email','phone','upi','ip','text')),
  entity_value text not null,
  report_type  text not null
    check (report_type in ('scam','phishing','spam','fraud','other')),
  notes        text,
  created_at   timestamptz not null default now()
);

create index if not exists reports_entity
  on public.reports (entity_type, entity_value, created_at desc);
create index if not exists reports_user_id
  on public.reports (user_id, created_at desc);

alter table public.reports enable row level security;
drop policy if exists "users_own_reports" on public.reports;
create policy "users_own_reports" on public.reports
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- app_submit_report — authenticated user submits a scam report
-- ---------------------------------------------------------------------------
create or replace function public.app_submit_report(
  p_entity_type text,
  p_entity_value text,
  p_report_type  text,
  p_notes        text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'unauthenticated'; end if;

  insert into public.reports (user_id, entity_type, entity_value, report_type, notes)
  values (auth.uid(), p_entity_type, p_entity_value, p_report_type, p_notes)
  returning id into v_id;

  return v_id;
end;
$$;
revoke all  on function public.app_submit_report(text,text,text,text) from public;
grant execute on function public.app_submit_report(text,text,text,text) to authenticated;

-- ---------------------------------------------------------------------------
-- app_upsert_entity_intel — engine writes back per-source TI result (0009 table)
-- ---------------------------------------------------------------------------
create or replace function public.app_upsert_entity_intel(
  p_source      text,
  p_entity_type text,
  p_entity_value text,
  p_verdict     text,
  p_raw         jsonb,
  p_signals     jsonb,
  p_expires_at  timestamptz
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.entity_intel
    (source, entity_type, entity_value, verdict, raw, signals, fetched_at, expires_at)
  values
    (p_source, p_entity_type, p_entity_value, p_verdict, p_raw, p_signals, now(), p_expires_at)
  on conflict (source, entity_type, entity_value) do update set
    verdict    = excluded.verdict,
    raw        = excluded.raw,
    signals    = excluded.signals,
    fetched_at = now(),
    expires_at = excluded.expires_at;
end;
$$;
revoke all  on function public.app_upsert_entity_intel(text,text,text,text,jsonb,jsonb,timestamptz) from public;
grant execute on function public.app_upsert_entity_intel(text,text,text,text,jsonb,jsonb,timestamptz)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- app_get_reputation — aggregated, time-decayed reputation for an entity
-- ---------------------------------------------------------------------------
create or replace function public.app_get_reputation(
  p_entity_type  text,
  p_entity_value text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report_count   integer := 0;
  v_weighted_score numeric := 0;
  v_decay_lambda   constant numeric := 0.05; -- ln(2)/14 ≈ half-life 14 days
  v_report         record;
  v_days_old       numeric;
  v_intel          jsonb;
begin
  select count(*) into v_report_count
  from public.reports r
  where r.entity_type = p_entity_type and r.entity_value = p_entity_value;

  -- Time-decayed sum: each report contributes exp(-λ * age_days)
  for v_report in
    select created_at
    from   public.reports
    where  entity_type = p_entity_type and entity_value = p_entity_value
    order  by created_at desc
    limit  200
  loop
    v_days_old       := extract(epoch from (now() - v_report.created_at)) / 86400.0;
    v_weighted_score := v_weighted_score + exp(-v_decay_lambda * v_days_old);
  end loop;

  select jsonb_agg(
    jsonb_build_object('source', source, 'verdict', verdict, 'fetched_at', fetched_at)
    order by fetched_at desc
  )
  into v_intel
  from public.entity_intel
  where entity_type = p_entity_type
    and entity_value = p_entity_value
    and expires_at > now();

  return jsonb_build_object(
    'entity_type',           p_entity_type,
    'entity_value',          p_entity_value,
    'report_count',          v_report_count,
    'weighted_report_score', round(v_weighted_score::numeric, 4),
    'intel',                 coalesce(v_intel, '[]'::jsonb)
  );
end;
$$;
revoke all  on function public.app_get_reputation(text,text) from public;
grant execute on function public.app_get_reputation(text,text) to anon, authenticated;
