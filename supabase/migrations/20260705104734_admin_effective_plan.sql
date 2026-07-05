-- Neural Shield AI — show a user's effective (inherited) plan in the admin console.
-- Applied to production via MCP on 2026-07-05; mirrored here so repo = ledger.
--
-- A linked member's own profiles.plan is 'free'; their effective plan is the shared
-- Two-person/Family plan they belong to. app_effective_plan_for computes that for any
-- user, and both admin listings now expose it.
create or replace function public.app_effective_plan_for(p_user uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_own text; v_shared text;
begin
  select p.plan into v_own from public.profiles p where p.id = p_user;
  if v_own is null then return 'free'; end if;
  select o.plan into v_shared
    from public.plan_memberships m
    join public.profiles o on o.id = m.owner_id
    where m.member_id = p_user and o.plan in ('two_person','family')
    order by case o.plan when 'family' then 3 when 'two_person' then 2 else 0 end desc
    limit 1;
  if v_shared is null then return v_own; end if;
  if (case v_own when 'pro' then 4 when 'family' then 3 when 'two_person' then 2 when 'individual' then 1 else 0 end)
     >= (case v_shared when 'family' then 3 when 'two_person' then 2 else 0 end)
  then return v_own; else return v_shared; end if;
end; $$;
revoke all on function public.app_effective_plan_for(uuid) from public, anon;
grant execute on function public.app_effective_plan_for(uuid) to authenticated;

create or replace function public.admin_get_users(p_limit integer default 20, p_offset integer default 0, p_search text default null, p_plan text default null, p_sort_by text default 'created_at', p_sort_dir text default 'desc')
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_total bigint; v_rows jsonb;
begin
  if not admin_is_admin() then raise exception 'Access denied' using errcode = '42501'; end if;
  select count(*) into v_total from public.profiles p
  where (p_search is null or p.email ilike '%'||p_search||'%' or p.name ilike '%'||p_search||'%')
    and (p_plan is null or p.plan = p_plan);
  select coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) into v_rows
  from (
    select p.id, p.email, p.name, p.plan,
           public.app_effective_plan_for(p.id) as effective_plan,
           p.is_admin, p.avatar_url, p.created_at, p.updated_at,
           (select count(*) from public.scans s where s.user_id = p.id) as total_scans,
           (select max(s.created_at) from public.scans s where s.user_id = p.id) as last_scan_at
    from public.profiles p
    where (p_search is null or p.email ilike '%'||p_search||'%' or p.name ilike '%'||p_search||'%')
      and (p_plan is null or p.plan = p_plan)
    order by
      case when p_sort_by='email' and p_sort_dir='asc'  then p.email end asc  nulls last,
      case when p_sort_by='email' and p_sort_dir='desc' then p.email end desc nulls last,
      case when p_sort_by='name'  and p_sort_dir='asc'  then p.name  end asc  nulls last,
      case when p_sort_by='name'  and p_sort_dir='desc' then p.name  end desc nulls last,
      case when p_sort_by='created_at' and p_sort_dir='asc' then p.created_at end asc nulls last,
      p.created_at desc
    limit p_limit offset p_offset
  ) t;
  return jsonb_build_object('users', v_rows, 'total', v_total, 'limit', p_limit, 'offset', p_offset);
end; $function$;

create or replace function public.admin_get_user(p_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
begin
  if not admin_is_admin() then raise exception 'Access denied' using errcode = '42501'; end if;
  return (
    select jsonb_build_object(
      'profile',        row_to_json(p)::jsonb,
      'effective_plan', public.app_effective_plan_for(p.id),
      'total_scans',    (select count(*) from public.scans s where s.user_id = p.id),
      'scans_by_risk',  (select coalesce(jsonb_object_agg(risk_level, cnt), '{}'::jsonb)
                         from (select risk_level, count(*) as cnt from public.scans where user_id = p.id group by risk_level) t),
      'recent_scans',   (select coalesce(jsonb_agg(row_to_json(s)::jsonb order by s.created_at desc), '[]'::jsonb)
                         from (select id, scan_type, risk_level, scam_probability, trust_score, created_at
                               from public.scans where user_id = p.id order by created_at desc limit 10) s),
      'feedback_count', (select count(*) from public.feedback f where f.user_id = p.id),
      'subscription',   (select row_to_json(sub)::jsonb from public.subscriptions sub where sub.user_id = p.id limit 1)
    )
    from public.profiles p where p.id = p_id
  );
end; $function$;
