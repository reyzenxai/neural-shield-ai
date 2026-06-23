-- Neural Shield AI — Trust Engine v2, Week 2 (threat-intel cache table)
-- See docs/evidence-collection-layer.md §4 and docs/reputation-database.md.
--
-- Per-source, verdict-aware TTL cache for external threat-intel lookups. In Week 2 the
-- engine uses an in-process cache (engine/cache.ts); this table is provisioned for the
-- persistent, cross-instance cache wired in Week 3 (alongside threat_sources + the
-- write RPC). Like scan_signals (0008), `source` is a text SourceId for now; a FK to
-- threat_sources is added with the full reputation schema.

create table if not exists public.entity_intel (
  id uuid primary key default uuid_generate_v4(),
  source text not null,                      -- gsb | urlhaus | phishtank | openphish | rdap | tls | ...
  entity_type text not null
    check (entity_type in ('url','domain','email','phone','upi','ip','text')),
  entity_value text not null,                -- canonical entity (eTLD+1 / normalized URL / e164 / vpa)
  verdict text not null default 'unknown'
    check (verdict in ('safe','suspicious','malicious','unknown')),
  raw jsonb,                                 -- raw source payload (audit)
  signals jsonb,                             -- cached Signal[] produced from this source
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (source, entity_type, entity_value)
);

-- lookup is by (source, entity) — the unique index covers it; expiry sweep needs its own
create index if not exists entity_intel_expires_at on public.entity_intel (expires_at);
create index if not exists entity_intel_entity on public.entity_intel (entity_type, entity_value);

-- Shared, non-PII verdict cache. Public-read so the engine/extension can consult it;
-- writes go through a SECURITY DEFINER RPC added in Week 3 (no direct user writes).
alter table public.entity_intel enable row level security;

drop policy if exists "entity_intel_public_read" on public.entity_intel;
create policy "entity_intel_public_read" on public.entity_intel
  for select using (true);
