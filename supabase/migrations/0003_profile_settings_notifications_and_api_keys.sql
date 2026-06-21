-- Neural Shield AI — profile notification prefs + Business API keys (Phase 5 / D9)
-- Mirrors live migration 20260620181247.

-- Notification preferences on profiles.
alter table public.profiles
  add column if not exists notification_prefs jsonb not null
  default '{"scam_alerts": true, "weekly_digest": false, "product_updates": true}'::jsonb;

-- API keys (Business tier). The full key is shown once; we store only a SHA-256 hash.
create table if not exists public.api_keys (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  key_prefix text not null,
  last_four text not null,
  key_hash text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index if not exists api_keys_user on public.api_keys (user_id, created_at desc);

alter table public.api_keys enable row level security;

drop policy if exists "api_keys_own" on public.api_keys;
create policy "api_keys_own" on public.api_keys
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
