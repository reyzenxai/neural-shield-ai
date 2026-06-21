-- Neural Shield AI — initial schema (Supabase Auth model)
-- Run in the Supabase SQL editor, or via `supabase db push`.
--
-- NOTE (decision D2): we use Supabase Auth. Credentials live in `auth.users`
-- (managed by Supabase). A 1:1 `public.profiles` row holds app data (plan, scan
-- counters, etc.) and is auto-created by a trigger. RLS policies key on auth.uid().

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- profiles — 1:1 with auth.users
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique not null,
  name text,
  plan text not null default 'free' check (plan in ('free', 'pro', 'business')),
  daily_scan_count integer not null default 0,
  daily_scan_reset_at timestamptz not null default now(),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- scans
-- ---------------------------------------------------------------------------
create table if not exists public.scans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  scan_type text not null check (scan_type in ('message','url','email','screenshot','qr','phone','upi')),
  input_text text,
  input_url text,
  input_file_path text,
  scam_probability double precision not null,
  trust_score integer not null,
  risk_level text not null check (risk_level in ('safe','low','medium','high','critical')),
  scam_type text,
  ai_model text not null,
  processing_time_ms integer,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- scan_flags
-- ---------------------------------------------------------------------------
create table if not exists public.scan_flags (
  id uuid primary key default uuid_generate_v4(),
  scan_id uuid not null references public.scans (id) on delete cascade,
  flag text not null,
  severity text not null check (severity in ('info','warning','danger')),
  description text
);

-- ---------------------------------------------------------------------------
-- subscriptions
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  plan text not null,
  status text not null check (status in ('active','cancelled','expired','trialing')),
  razorpay_subscription_id text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- feedback
-- ---------------------------------------------------------------------------
create table if not exists public.feedback (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles (id) on delete set null,
  scan_id uuid references public.scans (id) on delete set null,
  is_accurate boolean not null,
  comment text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- audit_logs (security / compliance)
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  resource text,
  ip_address text,
  user_agent text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- indexes
-- ---------------------------------------------------------------------------
create index if not exists scans_user_id_created_at on public.scans (user_id, created_at desc);
create index if not exists scan_flags_scan_id on public.scan_flags (scan_id);
create index if not exists audit_logs_user_id on public.audit_logs (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- auto-create a profile row when a new auth user signs up
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.scans enable row level security;
alter table public.scan_flags enable row level security;
alter table public.subscriptions enable row level security;
alter table public.feedback enable row level security;
alter table public.audit_logs enable row level security;

-- profiles: a user can read/update only their own row (insert handled by trigger).
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- scans: full CRUD scoped to the owner.
drop policy if exists "scans_own_data" on public.scans;
create policy "scans_own_data" on public.scans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- scan_flags: visible/owned via the parent scan.
drop policy if exists "scan_flags_via_scans" on public.scan_flags;
create policy "scan_flags_via_scans" on public.scan_flags
  for all using (
    exists (select 1 from public.scans s where s.id = scan_flags.scan_id and s.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.scans s where s.id = scan_flags.scan_id and s.user_id = auth.uid())
  );

-- subscriptions: owner-only.
drop policy if exists "subscriptions_own" on public.subscriptions;
create policy "subscriptions_own" on public.subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- feedback: a user can create and read their own feedback.
drop policy if exists "feedback_own" on public.feedback;
create policy "feedback_own" on public.feedback
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- audit_logs: a user can read AND insert their own entries. The backend writes
-- audit rows under the user's JWT (RLS), so the insert policy is required —
-- without it audit logging silently fails on a fresh deploy.
drop policy if exists "audit_logs_select_own" on public.audit_logs;
create policy "audit_logs_select_own" on public.audit_logs
  for select using (auth.uid() = user_id);

drop policy if exists "audit_logs_insert_own" on public.audit_logs;
create policy "audit_logs_insert_own" on public.audit_logs
  for insert with check (auth.uid() = user_id);
