-- Neural Shield AI - UPI payment requests with admin approval (phase 3)
-- Mirrors the applied migration payment_requests_and_admin_rpcs.
--
-- A user submits a payment request (plan + amount + a unique reference note + the
-- UPI transaction reference + a screenshot). An admin reviews it and approves or
-- rejects. Approval sets the user's plan via a SECURITY DEFINER RPC (the plan
-- column is revoked from users in 0006), matching the existing admin_* pattern.

create table if not exists public.payment_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan text not null check (plan in ('individual','two_person','family','pro')),
  amount_inr integer not null,
  reference_note text not null,
  upi_reference text,
  screenshot_path text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  review_note text,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists payment_requests_status on public.payment_requests (status, created_at desc);
create index if not exists payment_requests_user on public.payment_requests (user_id, created_at desc);

alter table public.payment_requests enable row level security;

drop policy if exists "payment_requests_own_insert" on public.payment_requests;
create policy "payment_requests_own_insert" on public.payment_requests
  for insert to authenticated with check (auth.uid() = user_id and status = 'pending');

drop policy if exists "payment_requests_own_select" on public.payment_requests;
create policy "payment_requests_own_select" on public.payment_requests
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "payment_requests_admin_select" on public.payment_requests;
create policy "payment_requests_admin_select" on public.payment_requests
  for select to authenticated
  using ((select p.is_admin from public.profiles p where p.id = auth.uid()));

-- Private bucket for payment screenshots.
insert into storage.buckets (id, name, public) values ('payment-proofs','payment-proofs', false)
  on conflict (id) do nothing;

drop policy if exists "payment_proofs_own_insert" on storage.objects;
create policy "payment_proofs_own_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "payment_proofs_read" on storage.objects;
create policy "payment_proofs_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'payment-proofs' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or (select p.is_admin from public.profiles p where p.id = auth.uid())
  ));

-- Admin RPCs (SECURITY DEFINER, is_admin checked inside).
create or replace function public.admin_list_payments(p_status text default 'pending')
returns table(id uuid, user_id uuid, user_email text, plan text, amount_inr integer,
  reference_note text, upi_reference text, screenshot_path text, status text, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false) then
    raise exception 'not_admin';
  end if;
  return query
    select pr.id, pr.user_id, u.email, pr.plan, pr.amount_inr, pr.reference_note,
           pr.upi_reference, pr.screenshot_path, pr.status, pr.created_at
    from public.payment_requests pr
    join public.profiles u on u.id = pr.user_id
    where (p_status is null or pr.status = p_status)
    order by pr.created_at desc
    limit 200;
end; $$;

create or replace function public.admin_approve_payment(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_admin uuid := auth.uid(); v_user uuid; v_plan text;
begin
  if not coalesce((select p.is_admin from public.profiles p where p.id = v_admin), false) then
    raise exception 'not_admin';
  end if;
  select pr.user_id, pr.plan into v_user, v_plan
    from public.payment_requests pr where pr.id = p_id and pr.status = 'pending';
  if v_user is null then raise exception 'not_found_or_not_pending'; end if;

  update public.profiles
    set plan = v_plan,
        monthly_scan_count = 0, monthly_scan_reset_at = pg_catalog.now(),
        daily_scan_count = 0, daily_scan_reset_at = pg_catalog.now()
    where id = v_user;

  update public.payment_requests
    set status = 'approved', reviewed_by = v_admin, reviewed_at = pg_catalog.now()
    where id = p_id;
end; $$;

create or replace function public.admin_reject_payment(p_id uuid, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_admin uuid := auth.uid();
begin
  if not coalesce((select p.is_admin from public.profiles p where p.id = v_admin), false) then
    raise exception 'not_admin';
  end if;
  update public.payment_requests
    set status = 'rejected', review_note = p_note, reviewed_by = v_admin, reviewed_at = pg_catalog.now()
    where id = p_id and status = 'pending';
end; $$;

revoke all on function public.admin_list_payments(text) from public;
grant execute on function public.admin_list_payments(text) to authenticated;
revoke all on function public.admin_approve_payment(uuid) from public;
grant execute on function public.admin_approve_payment(uuid) to authenticated;
revoke all on function public.admin_reject_payment(uuid, text) from public;
grant execute on function public.admin_reject_payment(uuid, text) to authenticated;
