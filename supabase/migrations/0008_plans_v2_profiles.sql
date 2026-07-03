-- Neural Shield AI - plans v2 (remove Business, widen plan values, monthly counters)
-- Mirrors the applied migration plans_v2_profiles.

-- Migrate any business rows to pro, then widen the allowed plan values.
update public.profiles set plan = 'pro' where plan = 'business';

alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles
  add constraint profiles_plan_check
  check (plan in ('free', 'individual', 'two_person', 'family', 'pro'));

-- Per-user monthly scan counter (the daily counter already exists).
alter table public.profiles
  add column if not exists monthly_scan_count integer not null default 0,
  add column if not exists monthly_scan_reset_at timestamptz not null default now();

-- The backend meters scans as the user (RLS), so it must be able to update the
-- counters. Extend the column grant from migration 0006.
grant update (name, avatar_url, notification_prefs, daily_scan_count, daily_scan_reset_at,
              monthly_scan_count, monthly_scan_reset_at)
  on public.profiles to authenticated;
