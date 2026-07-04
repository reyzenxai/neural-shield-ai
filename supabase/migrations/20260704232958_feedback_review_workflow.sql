-- Neural Shield AI — feedback review workflow.
-- Applied to production via MCP on 2026-07-04; mirrored here so repo = ledger.
--
-- An "unsatisfied" (is_accurate=false) submission is auto-flagged 'pending'; an admin
-- then marks it 'safe' (green) or 'unsafe' (red) from the admin console.
alter table public.feedback add column if not exists review_status text
  check (review_status in ('pending','safe','unsafe'));

create or replace function public.feedback_set_review_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.is_accurate = false and NEW.review_status is null then
    NEW.review_status := 'pending';
  end if;
  return NEW;
end; $$;

drop trigger if exists feedback_review_status_trg on public.feedback;
create trigger feedback_review_status_trg before insert on public.feedback
  for each row execute function public.feedback_set_review_status();

create or replace function public.admin_review_feedback(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not admin_is_admin() then
    raise exception 'Access denied' using errcode = '42501';
  end if;
  if p_status not in ('pending','safe','unsafe') then
    raise exception 'invalid_status';
  end if;
  update public.feedback set review_status = p_status where id = p_id;
end; $$;
revoke all on function public.admin_review_feedback(uuid, text) from public, anon;
grant execute on function public.admin_review_feedback(uuid, text) to authenticated;

create or replace function public.admin_get_feedback(p_limit integer default 20, p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_total bigint; v_rows jsonb;
begin
  if not admin_is_admin() then
    raise exception 'Access denied' using errcode = '42501';
  end if;
  select count(*) into v_total from public.feedback;
  select coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) into v_rows
  from (
    select f.id, f.is_accurate, f.comment, f.created_at, f.scan_id, f.review_status,
           p.email as user_email, p.name as user_name,
           s.scan_type, s.risk_level, s.scam_probability
    from public.feedback f
    left join public.profiles p on p.id = f.user_id
    left join public.scans    s on s.id = f.scan_id
    order by f.created_at desc
    limit p_limit offset p_offset
  ) t;
  return jsonb_build_object('feedback', v_rows, 'total', v_total, 'limit', p_limit, 'offset', p_offset);
end; $$;
