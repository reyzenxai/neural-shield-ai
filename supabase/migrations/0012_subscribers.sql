-- Neural Shield AI - newsletter subscribers (phase 5)
-- Mirrors the applied migration subscribers.
--
-- Visitors subscribe with their email from the website. Writes go through the
-- app_subscribe RPC (SECURITY DEFINER) so anon never touches the table directly.
-- Reads are admin-only; the n8n workflow that sends update emails uses its own DB
-- role or the service key.

create table if not exists public.subscribers (
  id uuid primary key default uuid_generate_v4(),
  email text not null unique,
  confirmed boolean not null default true,
  source text,
  created_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);

alter table public.subscribers enable row level security;

drop policy if exists "subscribers_admin_select" on public.subscribers;
create policy "subscribers_admin_select" on public.subscribers
  for select to authenticated
  using ((select p.is_admin from public.profiles p where p.id = auth.uid()));

create or replace function public.app_subscribe(p_email text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_email text := lower(trim(p_email));
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email';
  end if;
  insert into public.subscribers (email, source) values (v_email, 'website')
    on conflict (email) do nothing;
end; $$;

revoke all on function public.app_subscribe(text) from public;
grant execute on function public.app_subscribe(text) to anon, authenticated;
