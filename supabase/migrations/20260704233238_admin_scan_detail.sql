-- Neural Shield AI — richer admin scan-detail view.
-- Applied to production via MCP on 2026-07-04; mirrored here so repo = ledger.
--
-- Returns the full (untruncated) scan row + its flags + any feedback for one scan,
-- for the admin detail modal. Admin-only.
create or replace function public.admin_get_scan_detail(p_scan_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_scan jsonb; v_flags jsonb; v_feedback jsonb;
begin
  if not admin_is_admin() then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  select to_jsonb(s) || jsonb_build_object('user_email', p.email, 'user_name', p.name)
    into v_scan
  from public.scans s
  left join public.profiles p on p.id = s.user_id
  where s.id = p_scan_id;

  if v_scan is null then
    raise exception 'not_found';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'flag', fl.flag, 'severity', fl.severity, 'description', fl.description)), '[]'::jsonb)
    into v_flags
  from public.scan_flags fl where fl.scan_id = p_scan_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'is_accurate', fb.is_accurate, 'review_status', fb.review_status,
           'comment', fb.comment, 'created_at', fb.created_at)), '[]'::jsonb)
    into v_feedback
  from public.feedback fb where fb.scan_id = p_scan_id;

  return v_scan || jsonb_build_object('flags', v_flags, 'feedback', v_feedback);
end; $$;

revoke all on function public.admin_get_scan_detail(uuid) from public, anon;
grant execute on function public.admin_get_scan_detail(uuid) to authenticated;
