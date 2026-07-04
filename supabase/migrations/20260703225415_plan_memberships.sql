-- Neural Shield AI - plan_memberships (multi-user plans: Two-person, Family)
-- Mirrors the applied migration plan_memberships.
--
-- An owner links members by the email they signed up with. Each member gets their
-- own per-user quota. email_locked_until enforces the once-per-billing-month change
-- rule (set when the plan is activated).

create table if not exists public.plan_memberships (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  slot smallint not null check (slot between 1 and 3),
  member_email text not null,
  member_id uuid references public.profiles (id) on delete set null,
  email_locked_until timestamptz,
  linked_at timestamptz not null default now(),
  unique (owner_id, slot)
);
create index if not exists plan_memberships_owner on public.plan_memberships (owner_id);
create index if not exists plan_memberships_member on public.plan_memberships (member_id);

alter table public.plan_memberships enable row level security;

-- The owner manages their own membership rows.
drop policy if exists "plan_memberships_owner" on public.plan_memberships;
create policy "plan_memberships_owner" on public.plan_memberships
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- A linked member may read the row that links them (to see their effective plan).
drop policy if exists "plan_memberships_member_read" on public.plan_memberships;
create policy "plan_memberships_member_read" on public.plan_memberships
  for select using (auth.uid() = member_id);
