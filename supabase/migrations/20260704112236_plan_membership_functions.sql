-- Neural Shield AI - multi-user plan functions (phase 4)
-- Mirrors the applied migration plan_membership_functions.
--
-- app_effective_plan(): the caller's own plan, or the higher shared plan they are a
--   linked member of (only Two-person/Family confer quota to members). The backend
--   uses this so a linked member actually receives the owner's per-user quota.
-- app_link_member / app_unlink_member: the owner manages slots. Initial link is free;
--   changing a member is allowed once, then locked for 30 days.
-- resolve_pending_members: when someone signs up with an email that was linked before
--   they had an account, their member_id is filled in automatically.

create or replace function public.app_effective_plan()
returns text language plpgsql security definer set search_path = '' as $$
declare v_own text; v_shared text;
begin
  select p.plan into v_own from public.profiles p where p.id = auth.uid();
  if v_own is null then return 'free'; end if;

  select o.plan into v_shared
    from public.plan_memberships m
    join public.profiles o on o.id = m.owner_id
    where m.member_id = auth.uid() and o.plan in ('two_person','family')
    order by case o.plan when 'family' then 3 when 'two_person' then 2 else 0 end desc
    limit 1;

  if v_shared is null then return v_own; end if;
  if (case v_own when 'pro' then 4 when 'family' then 3 when 'two_person' then 2 when 'individual' then 1 else 0 end)
     >= (case v_shared when 'family' then 3 when 'two_person' then 2 else 0 end)
  then return v_own; else return v_shared; end if;
end; $$;

create or replace function public.app_link_member(p_slot int, p_email text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_plan text; v_max int; v_member uuid;
  v_email text := lower(trim(p_email)); v_row public.plan_memberships;
begin
  select p.plan into v_plan from public.profiles p where p.id = v_owner;
  if v_plan not in ('two_person','family') then raise exception 'not_multi_user_plan'; end if;
  v_max := case v_plan when 'two_person' then 1 else 3 end;
  if p_slot < 1 or p_slot > v_max then raise exception 'invalid_slot'; end if;
  if v_email = '' then raise exception 'empty_email'; end if;

  select p.id into v_member from public.profiles p where lower(p.email) = v_email;
  if v_member = v_owner then raise exception 'cannot_link_self'; end if;

  if exists (select 1 from public.plan_memberships m
             where m.owner_id = v_owner and m.slot <> p_slot and lower(m.member_email) = v_email) then
    raise exception 'already_linked';
  end if;

  select * into v_row from public.plan_memberships m where m.owner_id = v_owner and m.slot = p_slot;

  if v_row.id is null then
    insert into public.plan_memberships (owner_id, slot, member_email, member_id, email_locked_until)
      values (v_owner, p_slot, v_email, v_member, null);
  elsif lower(coalesce(v_row.member_email, '')) = v_email then
    update public.plan_memberships set member_id = v_member
      where owner_id = v_owner and slot = p_slot;
  else
    if v_row.email_locked_until is not null and v_row.email_locked_until > pg_catalog.now() then
      raise exception 'email_change_locked';
    end if;
    update public.plan_memberships
      set member_email = v_email, member_id = v_member,
          email_locked_until = pg_catalog.now() + interval '30 days'
      where owner_id = v_owner and slot = p_slot;
  end if;
end; $$;

create or replace function public.app_unlink_member(p_slot int)
returns void language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_row public.plan_memberships;
begin
  select * into v_row from public.plan_memberships m where m.owner_id = v_owner and m.slot = p_slot;
  if v_row.id is null then return; end if;
  if v_row.email_locked_until is not null and v_row.email_locked_until > pg_catalog.now() then
    raise exception 'email_change_locked';
  end if;
  delete from public.plan_memberships where owner_id = v_owner and slot = p_slot;
end; $$;

create or replace function public.resolve_pending_members()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.plan_memberships set member_id = new.id
    where member_id is null and lower(member_email) = lower(new.email);
  return new;
end; $$;

drop trigger if exists resolve_pending_members_on_profile on public.profiles;
create trigger resolve_pending_members_on_profile
  after insert on public.profiles
  for each row execute function public.resolve_pending_members();

revoke all on function public.app_effective_plan() from public;
grant execute on function public.app_effective_plan() to authenticated;
revoke all on function public.app_link_member(int, text) from public;
grant execute on function public.app_link_member(int, text) to authenticated;
revoke all on function public.app_unlink_member(int) from public;
grant execute on function public.app_unlink_member(int) to authenticated;
