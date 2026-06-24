-- 0011_admin_role.sql
-- Add is_admin to profiles, create admin_logs table, and SECURITY DEFINER
-- functions for admin data access. All admin functions verify admin status
-- via auth.uid() — the calling JWT must belong to a row with is_admin = true.

-- ─── 1. Add is_admin column ────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- ─── 2. admin_logs table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action      text        NOT NULL,  -- 'login' | 'view_user' | 'export_users' | 'view_scan' | ...
  resource    text        NOT NULL,  -- 'user' | 'scan' | 'feedback' | 'system'
  target_id   uuid,                  -- id of the viewed/modified resource, if any
  ip_address  text,
  user_agent  text,
  metadata    jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_logs_admin_id_idx   ON public.admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS admin_logs_created_at_idx ON public.admin_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS admin_logs_action_idx     ON public.admin_logs(action);

-- ─── 3. RLS for admin_logs ────────────────────────────────────────────────
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- Admins can read all audit logs.
CREATE POLICY "admin_logs_select" ON public.admin_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Any authenticated user can insert a log row as themselves.
-- (Only called from admin-gated endpoints, so this is effectively admin-only.)
CREATE POLICY "admin_logs_insert" ON public.admin_logs
  FOR INSERT WITH CHECK (admin_id = auth.uid());

-- ─── 4. Helper: is current user an admin? ─────────────────────────────────
CREATE OR REPLACE FUNCTION admin_is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
  );
END;
$$;
GRANT EXECUTE ON FUNCTION admin_is_admin() TO authenticated;

-- ─── 5. admin_get_stats ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT admin_is_admin() THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'total_users',      (SELECT count(*) FROM public.profiles),
    'active_users_30d', (SELECT count(DISTINCT user_id) FROM public.scans WHERE created_at > now() - interval '30 days'),
    'total_scans',      (SELECT count(*) FROM public.scans),
    'scans_today',      (SELECT count(*) FROM public.scans WHERE created_at >= current_date),
    'high_risk_scans',  (SELECT count(*) FROM public.scans WHERE risk_level IN ('high', 'critical')),
    'avg_scam_score',   (SELECT coalesce(round(avg(scam_probability * 100)::numeric, 1), 0) FROM public.scans),
    'total_feedback',   (SELECT count(*) FROM public.feedback),
    'users_by_plan', (
      SELECT coalesce(jsonb_object_agg(plan, cnt), '{}'::jsonb)
      FROM (SELECT plan, count(*) AS cnt FROM public.profiles GROUP BY plan) t
    ),
    'scans_by_risk', (
      SELECT coalesce(jsonb_object_agg(risk_level, cnt), '{}'::jsonb)
      FROM (SELECT risk_level, count(*) AS cnt FROM public.scans GROUP BY risk_level) t
    ),
    'scans_by_type', (
      SELECT coalesce(jsonb_object_agg(scan_type, cnt), '{}'::jsonb)
      FROM (SELECT scan_type, count(*) AS cnt FROM public.scans GROUP BY scan_type) t
    ),
    'daily_scans', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('date', d, 'count', cnt) ORDER BY d), '[]'::jsonb)
      FROM (
        SELECT date_trunc('day', created_at)::date AS d, count(*) AS cnt
        FROM public.scans
        WHERE created_at >= now() - interval '30 days'
        GROUP BY 1
      ) t
    ),
    'daily_signups', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('date', d, 'count', cnt) ORDER BY d), '[]'::jsonb)
      FROM (
        SELECT date_trunc('day', created_at)::date AS d, count(*) AS cnt
        FROM public.profiles
        WHERE created_at >= now() - interval '30 days'
        GROUP BY 1
      ) t
    )
  );
END;
$$;
GRANT EXECUTE ON FUNCTION admin_get_stats() TO authenticated;

-- ─── 6. admin_get_users ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_users(
  p_limit    integer DEFAULT 20,
  p_offset   integer DEFAULT 0,
  p_search   text    DEFAULT NULL,
  p_plan     text    DEFAULT NULL,
  p_sort_by  text    DEFAULT 'created_at',
  p_sort_dir text    DEFAULT 'desc'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint;
  v_rows  jsonb;
BEGIN
  IF NOT admin_is_admin() THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_total
  FROM public.profiles p
  WHERE (p_search IS NULL OR p.email ILIKE '%' || p_search || '%'
                          OR p.name  ILIKE '%' || p_search || '%')
    AND (p_plan IS NULL OR p.plan = p_plan);

  SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT
      p.id,
      p.email,
      p.name,
      p.plan,
      p.is_admin,
      p.avatar_url,
      p.created_at,
      p.updated_at,
      (SELECT count(*) FROM public.scans s WHERE s.user_id = p.id)       AS total_scans,
      (SELECT max(s.created_at) FROM public.scans s WHERE s.user_id = p.id) AS last_scan_at
    FROM public.profiles p
    WHERE (p_search IS NULL OR p.email ILIKE '%' || p_search || '%'
                            OR p.name  ILIKE '%' || p_search || '%')
      AND (p_plan IS NULL OR p.plan = p_plan)
    ORDER BY
      CASE WHEN p_sort_by = 'email'       AND p_sort_dir = 'asc'  THEN p.email        END ASC  NULLS LAST,
      CASE WHEN p_sort_by = 'email'       AND p_sort_dir = 'desc' THEN p.email        END DESC NULLS LAST,
      CASE WHEN p_sort_by = 'name'        AND p_sort_dir = 'asc'  THEN p.name         END ASC  NULLS LAST,
      CASE WHEN p_sort_by = 'name'        AND p_sort_dir = 'desc' THEN p.name         END DESC NULLS LAST,
      CASE WHEN p_sort_by = 'created_at'  AND p_sort_dir = 'asc'  THEN p.created_at   END ASC  NULLS LAST,
      p.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) t;

  RETURN jsonb_build_object(
    'users',  v_rows,
    'total',  v_total,
    'limit',  p_limit,
    'offset', p_offset
  );
END;
$$;
GRANT EXECUTE ON FUNCTION admin_get_users(integer, integer, text, text, text, text) TO authenticated;

-- ─── 7. admin_get_user ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_user(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT admin_is_admin() THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'profile',        row_to_json(p)::jsonb,
      'total_scans',    (SELECT count(*) FROM public.scans s WHERE s.user_id = p.id),
      'scans_by_risk',  (
        SELECT coalesce(jsonb_object_agg(risk_level, cnt), '{}'::jsonb)
        FROM (SELECT risk_level, count(*) AS cnt FROM public.scans WHERE user_id = p.id GROUP BY risk_level) t
      ),
      'recent_scans',   (
        SELECT coalesce(jsonb_agg(row_to_json(s)::jsonb ORDER BY s.created_at DESC), '[]'::jsonb)
        FROM (
          SELECT id, scan_type, risk_level, scam_probability, trust_score, created_at
          FROM public.scans WHERE user_id = p.id ORDER BY created_at DESC LIMIT 10
        ) s
      ),
      'feedback_count', (SELECT count(*) FROM public.feedback f WHERE f.user_id = p.id),
      'subscription',   (SELECT row_to_json(sub)::jsonb FROM public.subscriptions sub WHERE sub.user_id = p.id LIMIT 1)
    )
    FROM public.profiles p
    WHERE p.id = p_id
  );
END;
$$;
GRANT EXECUTE ON FUNCTION admin_get_user(uuid) TO authenticated;

-- ─── 8. admin_get_scans ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_scans(
  p_limit      integer     DEFAULT 20,
  p_offset     integer     DEFAULT 0,
  p_risk_level text        DEFAULT NULL,
  p_scan_type  text        DEFAULT NULL,
  p_date_from  timestamptz DEFAULT NULL,
  p_date_to    timestamptz DEFAULT NULL,
  p_user_id    uuid        DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint;
  v_rows  jsonb;
BEGIN
  IF NOT admin_is_admin() THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_total
  FROM public.scans s
  WHERE (p_risk_level IS NULL OR s.risk_level = p_risk_level)
    AND (p_scan_type  IS NULL OR s.scan_type  = p_scan_type)
    AND (p_date_from  IS NULL OR s.created_at >= p_date_from)
    AND (p_date_to    IS NULL OR s.created_at <= p_date_to)
    AND (p_user_id    IS NULL OR s.user_id    = p_user_id);

  SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT
      s.id,
      s.user_id,
      s.scan_type,
      s.risk_level,
      s.scam_probability,
      s.trust_score,
      s.scam_type,
      s.ai_model,
      s.processing_time_ms,
      s.created_at,
      p.email AS user_email,
      p.name  AS user_name,
      -- Truncate sensitive input at 120 chars to avoid leaking full message content
      CASE WHEN s.input_text IS NOT NULL THEN left(s.input_text, 120) ELSE NULL END AS input_preview,
      s.input_url
    FROM public.scans s
    JOIN public.profiles p ON p.id = s.user_id
    WHERE (p_risk_level IS NULL OR s.risk_level = p_risk_level)
      AND (p_scan_type  IS NULL OR s.scan_type  = p_scan_type)
      AND (p_date_from  IS NULL OR s.created_at >= p_date_from)
      AND (p_date_to    IS NULL OR s.created_at <= p_date_to)
      AND (p_user_id    IS NULL OR s.user_id    = p_user_id)
    ORDER BY s.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) t;

  RETURN jsonb_build_object(
    'scans',  v_rows,
    'total',  v_total,
    'limit',  p_limit,
    'offset', p_offset
  );
END;
$$;
GRANT EXECUTE ON FUNCTION admin_get_scans(integer, integer, text, text, timestamptz, timestamptz, uuid) TO authenticated;

-- ─── 9. admin_get_feedback ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_feedback(
  p_limit  integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint;
  v_rows  jsonb;
BEGIN
  IF NOT admin_is_admin() THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_total FROM public.feedback;

  SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT
      f.id,
      f.is_accurate,
      f.comment,
      f.created_at,
      f.scan_id,
      p.email AS user_email,
      p.name  AS user_name,
      s.scan_type,
      s.risk_level,
      s.scam_probability
    FROM public.feedback f
    LEFT JOIN public.profiles p ON p.id = f.user_id
    LEFT JOIN public.scans    s ON s.id = f.scan_id
    ORDER BY f.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) t;

  RETURN jsonb_build_object(
    'feedback', v_rows,
    'total',    v_total,
    'limit',    p_limit,
    'offset',   p_offset
  );
END;
$$;
GRANT EXECUTE ON FUNCTION admin_get_feedback(integer, integer) TO authenticated;

-- ─── 10. admin_get_logs ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_logs(
  p_limit  integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint;
  v_rows  jsonb;
BEGIN
  IF NOT admin_is_admin() THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_total FROM public.admin_logs;

  SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT
      l.id,
      l.action,
      l.resource,
      l.target_id,
      l.ip_address,
      l.metadata,
      l.created_at,
      p.email AS admin_email,
      p.name  AS admin_name
    FROM public.admin_logs l
    LEFT JOIN public.profiles p ON p.id = l.admin_id
    ORDER BY l.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) t;

  RETURN jsonb_build_object(
    'logs',   v_rows,
    'total',  v_total,
    'limit',  p_limit,
    'offset', p_offset
  );
END;
$$;
GRANT EXECUTE ON FUNCTION admin_get_logs(integer, integer) TO authenticated;
