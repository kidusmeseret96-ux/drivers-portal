-- ============================================================================
-- RouteLedger / ADAMA HEAVY TRUCK DRIVERS EDIR
-- Supabase PostgreSQL Schema, RLS Lockdown & Role-Scoped Portal RPCs
--
-- Run this script once in your Supabase Dashboard -> SQL Editor.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Sync secret configuration (server-side hashed office sync key)
CREATE TABLE IF NOT EXISTS public.ada_sync_config (
  id TEXT PRIMARY KEY DEFAULT 'primary',
  sync_key_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Core domain tables (lossless JSONB + indexed relational columns)
CREATE TABLE IF NOT EXISTS public.ada_settings (
  id TEXT PRIMARY KEY DEFAULT 'primary',
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ada_members (
  id TEXT PRIMARY KEY,
  member_id TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'Member',
  status TEXT NOT NULL DEFAULT 'Active',
  deleted_at TEXT,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ada_members_code ON public.ada_members (UPPER(member_id));
CREATE INDEX IF NOT EXISTS idx_ada_members_role ON public.ada_members (role);

CREATE TABLE IF NOT EXISTS public.ada_payments (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  status TEXT NOT NULL,
  date TEXT NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ada_payments_member ON public.ada_payments (member_id);

CREATE TABLE IF NOT EXISTS public.ada_penalties (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  status TEXT NOT NULL,
  date TEXT NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ada_penalties_member ON public.ada_penalties (member_id);

CREATE TABLE IF NOT EXISTS public.ada_expenses (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ada_trips (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  status TEXT NOT NULL,
  dispatch_date TEXT NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ada_trips_member ON public.ada_trips (member_id);

CREATE TABLE IF NOT EXISTS public.ada_mutual_aid (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  status TEXT NOT NULL,
  date TEXT NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ada_mutual_aid_member ON public.ada_mutual_aid (member_id);

CREATE TABLE IF NOT EXISTS public.ada_incidents (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  status TEXT NOT NULL,
  date TEXT NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ada_incidents_member ON public.ada_incidents (member_id);

-- 3. Member portal login credentials (default password = '0000', bcrypt hashed)
CREATE TABLE IF NOT EXISTS public.ada_member_credentials (
  member_pk TEXT PRIMARY KEY REFERENCES public.ada_members(id) ON DELETE CASCADE,
  member_code TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Ephemeral portal sessions (stored in client memory only)
CREATE TABLE IF NOT EXISTS public.ada_portal_sessions (
  token TEXT PRIMARY KEY,
  member_pk TEXT NOT NULL REFERENCES public.ada_members(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ada_portal_sessions_exp ON public.ada_portal_sessions (expires_at);

-- 5. Enable Row Level Security on ALL tables (blocks raw anon REST table queries)
ALTER TABLE public.ada_sync_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ada_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ada_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ada_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ada_penalties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ada_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ada_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ada_mutual_aid ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ada_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ada_member_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ada_portal_sessions ENABLE ROW LEVEL SECURITY;

-- 6. Internal helper: check whether a member role has full office access
CREATE OR REPLACE FUNCTION public._ada_is_full_access_role(
  p_role TEXT,
  p_settings JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_roles JSONB;
  v_role TEXT := LOWER(TRIM(COALESCE(p_role, 'Member')));
BEGIN
  IF v_role = '' OR v_role = 'member' THEN
    RETURN FALSE;
  END IF;

  v_roles := p_settings->'portalFullAccessRoles';
  IF v_roles IS NOT NULL AND jsonb_typeof(v_roles) = 'array' THEN
    RETURN EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(v_roles) AS r(val)
      WHERE LOWER(TRIM(r.val)) = v_role
    );
  END IF;

  -- Default rule: any office role assigned in the offline app (not 'Member') has full access
  RETURN TRUE;
END;
$$;

-- 7. Internal helper: sanitize settings JSON before returning to portal users
CREATE OR REPLACE FUNCTION public._ada_public_settings(p_settings JSONB)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(p_settings, '{}'::jsonb)
    - 'loginPassword'
    - 'loginUsername'
    - 'supabaseSyncKey'
    - 'supabaseAnonKey'
    - 'supabaseUrl';
$$;

-- 8. Public branding for login screen (returns only association name, logo, language)
CREATE OR REPLACE FUNCTION public.portal_public_branding()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_settings JSONB;
BEGIN
  SELECT data INTO v_settings FROM public.ada_settings WHERE id = 'primary';
  RETURN jsonb_build_object(
    'associationName', COALESCE(v_settings->>'associationName', 'ADAMA HEAVY TRUCK DRIVERS EDIR'),
    'logoDataUrl', v_settings->'logoDataUrl',
    'language', COALESCE(v_settings->>'language', 'en')
  );
END;
$$;

-- 9. Portal Sign-In (Member ID + Password; default password is '0000')
CREATE OR REPLACE FUNCTION public.portal_login(
  p_member_id TEXT,
  p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_clean_code TEXT := UPPER(TRIM(COALESCE(p_member_id, '')));
  v_member public.ada_members%ROWTYPE;
  v_cred public.ada_member_credentials%ROWTYPE;
  v_settings JSONB;
  v_is_full BOOLEAN;
  v_token TEXT;
BEGIN
  IF v_clean_code = '' OR COALESCE(p_password, '') = '' THEN
    RAISE EXCEPTION 'Member ID and password are required';
  END IF;

  SELECT * INTO v_member
  FROM public.ada_members
  WHERE UPPER(TRIM(member_id)) = v_clean_code
     OR UPPER(REGEXP_REPLACE(member_id, '[^A-Z0-9]', '', 'g')) = REGEXP_REPLACE(v_clean_code, '[^A-Z0-9]', '', 'g')
     OR (v_clean_code ~ '^[0-9]{1,6}$' AND UPPER(TRIM(member_id)) = 'ADA-' || LPAD(v_clean_code, 4, '0'))
  ORDER BY
    CASE WHEN UPPER(TRIM(member_id)) = v_clean_code THEN 0 ELSE 1 END
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid Member ID or password';
  END IF;

  IF v_member.deleted_at IS NOT NULL OR v_member.status <> 'Active' THEN
    RAISE EXCEPTION 'This member account is inactive or archived';
  END IF;

  -- Ensure default '0000' credential exists if member was synced before credentials row
  SELECT * INTO v_cred
  FROM public.ada_member_credentials
  WHERE member_pk = v_member.id;

  IF NOT FOUND THEN
    INSERT INTO public.ada_member_credentials (member_pk, member_code, password_hash, must_change_password)
    VALUES (v_member.id, v_member.member_id, crypt('0000', gen_salt('bf')), TRUE)
    ON CONFLICT (member_pk) DO NOTHING;

    SELECT * INTO v_cred
    FROM public.ada_member_credentials
    WHERE member_pk = v_member.id;
  END IF;

  IF crypt(p_password, v_cred.password_hash) <> v_cred.password_hash THEN
    RAISE EXCEPTION 'Invalid Member ID or password';
  END IF;

  SELECT data INTO v_settings FROM public.ada_settings WHERE id = 'primary';
  v_is_full := public._ada_is_full_access_role(v_member.role, v_settings);

  -- Clean expired sessions opportunistically
  DELETE FROM public.ada_portal_sessions WHERE expires_at <= NOW();

  v_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.ada_portal_sessions (token, member_pk, expires_at)
  VALUES (v_token, v_member.id, NOW() + INTERVAL '7 days');

  RETURN jsonb_build_object(
    'token', v_token,
    'mustChangePassword', v_cred.must_change_password,
    'memberPk', v_member.id,
    'memberId', v_member.member_id,
    'fullName', COALESCE(v_member.data->>'fullName', v_member.member_id),
    'role', v_member.role,
    'isFullAccess', v_is_full
  );
END;
$$;

-- 10. Change own password once signed in
CREATE OR REPLACE FUNCTION public.portal_change_password(
  p_token TEXT,
  p_current_password TEXT,
  p_new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session public.ada_portal_sessions%ROWTYPE;
  v_cred public.ada_member_credentials%ROWTYPE;
BEGIN
  SELECT * INTO v_session
  FROM public.ada_portal_sessions
  WHERE token = p_token AND expires_at > NOW();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session expired. Please sign in again.';
  END IF;

  IF LENGTH(COALESCE(p_new_password, '')) < 4 THEN
    RAISE EXCEPTION 'New password must be at least 4 characters.';
  END IF;

  IF p_new_password = '0000' THEN
    RAISE EXCEPTION 'Please choose a new password different from 0000.';
  END IF;

  SELECT * INTO v_cred
  FROM public.ada_member_credentials
  WHERE member_pk = v_session.member_pk;

  IF NOT FOUND OR crypt(COALESCE(p_current_password, ''), v_cred.password_hash) <> v_cred.password_hash THEN
    RAISE EXCEPTION 'Current password is incorrect.';
  END IF;

  UPDATE public.ada_member_credentials
  SET
    password_hash = crypt(p_new_password, gen_salt('bf')),
    must_change_password = FALSE,
    updated_at = NOW()
  WHERE member_pk = v_session.member_pk;

  RETURN jsonb_build_object('success', TRUE, 'mustChangePassword', FALSE);
END;
$$;

-- 11. Sign out
CREATE OR REPLACE FUNCTION public.portal_logout(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  DELETE FROM public.ada_portal_sessions WHERE token = p_token;
  RETURN jsonb_build_object('success', TRUE);
END;
$$;

-- 12. Fetch role-scoped workspace data
--     Regular 'Member' -> ONLY their own profile, payments, penalties, trips, mutualAid, incidents
--     Office Role      -> ALL association data (full office view)
CREATE OR REPLACE FUNCTION public.portal_get_workspace(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session public.ada_portal_sessions%ROWTYPE;
  v_member public.ada_members%ROWTYPE;
  v_cred public.ada_member_credentials%ROWTYPE;
  v_settings JSONB;
  v_is_full BOOLEAN;
BEGIN
  SELECT * INTO v_session
  FROM public.ada_portal_sessions
  WHERE token = p_token AND expires_at > NOW();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unauthorized or expired session';
  END IF;

  SELECT * INTO v_member FROM public.ada_members WHERE id = v_session.member_pk;
  IF NOT FOUND OR v_member.deleted_at IS NOT NULL OR v_member.status <> 'Active' THEN
    DELETE FROM public.ada_portal_sessions WHERE token = p_token;
    RAISE EXCEPTION 'Member account is no longer active';
  END IF;

  SELECT * INTO v_cred FROM public.ada_member_credentials WHERE member_pk = v_member.id;
  SELECT data INTO v_settings FROM public.ada_settings WHERE id = 'primary';
  v_is_full := public._ada_is_full_access_role(v_member.role, v_settings);

  IF v_is_full THEN
    RETURN jsonb_build_object(
      'isFullAccess', TRUE,
      'mustChangePassword', COALESCE(v_cred.must_change_password, TRUE),
      'currentMember', v_member.data,
      'settings', public._ada_public_settings(v_settings),
      'members', COALESCE((SELECT jsonb_agg(data ORDER BY member_id) FROM public.ada_members), '[]'::jsonb),
      'payments', COALESCE((SELECT jsonb_agg(data ORDER BY date DESC) FROM public.ada_payments), '[]'::jsonb),
      'penalties', COALESCE((SELECT jsonb_agg(data ORDER BY date DESC) FROM public.ada_penalties), '[]'::jsonb),
      'expenses', COALESCE((SELECT jsonb_agg(data ORDER BY date DESC) FROM public.ada_expenses), '[]'::jsonb),
      'trips', COALESCE((SELECT jsonb_agg(data ORDER BY dispatch_date DESC) FROM public.ada_trips), '[]'::jsonb),
      'mutualAid', COALESCE((SELECT jsonb_agg(data ORDER BY date DESC) FROM public.ada_mutual_aid), '[]'::jsonb),
      'incidents', COALESCE((SELECT jsonb_agg(data ORDER BY date DESC) FROM public.ada_incidents), '[]'::jsonb)
    );
  ELSE
    RETURN jsonb_build_object(
      'isFullAccess', FALSE,
      'mustChangePassword', COALESCE(v_cred.must_change_password, TRUE),
      'currentMember', v_member.data,
      'settings', public._ada_public_settings(v_settings),
      'members', jsonb_build_array(v_member.data),
      'payments', COALESCE((SELECT jsonb_agg(data ORDER BY date DESC) FROM public.ada_payments WHERE member_id = v_member.id), '[]'::jsonb),
      'penalties', COALESCE((SELECT jsonb_agg(data ORDER BY date DESC) FROM public.ada_penalties WHERE member_id = v_member.id), '[]'::jsonb),
      'expenses', '[]'::jsonb,
      'trips', COALESCE((SELECT jsonb_agg(data ORDER BY dispatch_date DESC) FROM public.ada_trips WHERE member_id = v_member.id), '[]'::jsonb),
      'mutualAid', COALESCE((SELECT jsonb_agg(data ORDER BY date DESC) FROM public.ada_mutual_aid WHERE member_id = v_member.id), '[]'::jsonb),
      'incidents', COALESCE((SELECT jsonb_agg(data ORDER BY date DESC) FROM public.ada_incidents WHERE member_id = v_member.id), '[]'::jsonb)
    );
  END IF;
END;
$$;

-- 13. Office-role mutation RPC from the Cloudflare portal
CREATE OR REPLACE FUNCTION public.portal_admin_mutate(
  p_token TEXT,
  p_entity TEXT,
  p_record JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session public.ada_portal_sessions%ROWTYPE;
  v_member public.ada_members%ROWTYPE;
  v_settings JSONB;
  v_id TEXT := p_record->>'id';
BEGIN
  SELECT * INTO v_session
  FROM public.ada_portal_sessions
  WHERE token = p_token AND expires_at > NOW();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unauthorized or expired session';
  END IF;

  SELECT * INTO v_member FROM public.ada_members WHERE id = v_session.member_pk;
  SELECT data INTO v_settings FROM public.ada_settings WHERE id = 'primary';

  IF NOT FOUND OR v_member.deleted_at IS NOT NULL OR v_member.status <> 'Active' OR NOT public._ada_is_full_access_role(v_member.role, v_settings) THEN
    RAISE EXCEPTION 'Forbidden: Office role required';
  END IF;

  IF p_entity = 'members' THEN
    INSERT INTO public.ada_members (id, member_id, role, status, deleted_at, data, updated_at)
    VALUES (
      v_id,
      p_record->>'memberId',
      COALESCE(p_record->>'role', 'Member'),
      COALESCE(p_record->>'status', 'Active'),
      p_record->>'deletedAt',
      p_record,
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      member_id = EXCLUDED.member_id,
      role = EXCLUDED.role,
      status = EXCLUDED.status,
      deleted_at = EXCLUDED.deleted_at,
      data = EXCLUDED.data,
      updated_at = NOW();

    INSERT INTO public.ada_member_credentials (member_pk, member_code, password_hash, must_change_password)
    VALUES (v_id, p_record->>'memberId', crypt('0000', gen_salt('bf')), TRUE)
    ON CONFLICT (member_pk) DO UPDATE SET
      member_code = EXCLUDED.member_code;

  ELSIF p_entity = 'payments' THEN
    INSERT INTO public.ada_payments (id, member_id, status, date, data, updated_at)
    VALUES (v_id, p_record->>'memberId', COALESCE(p_record->>'status', 'Pending'), COALESCE(p_record->>'date', ''), p_record, NOW())
    ON CONFLICT (id) DO UPDATE SET
      member_id = EXCLUDED.member_id, status = EXCLUDED.status, date = EXCLUDED.date, data = EXCLUDED.data, updated_at = NOW();

  ELSIF p_entity = 'penalties' THEN
    INSERT INTO public.ada_penalties (id, member_id, status, date, data, updated_at)
    VALUES (v_id, p_record->>'memberId', COALESCE(p_record->>'status', 'Unpaid'), COALESCE(p_record->>'date', ''), p_record, NOW())
    ON CONFLICT (id) DO UPDATE SET
      member_id = EXCLUDED.member_id, status = EXCLUDED.status, date = EXCLUDED.date, data = EXCLUDED.data, updated_at = NOW();

  ELSIF p_entity = 'expenses' THEN
    INSERT INTO public.ada_expenses (id, date, data, updated_at)
    VALUES (v_id, COALESCE(p_record->>'date', ''), p_record, NOW())
    ON CONFLICT (id) DO UPDATE SET
      date = EXCLUDED.date, data = EXCLUDED.data, updated_at = NOW();

  ELSIF p_entity = 'trips' THEN
    INSERT INTO public.ada_trips (id, member_id, status, dispatch_date, data, updated_at)
    VALUES (v_id, p_record->>'memberId', COALESCE(p_record->>'status', 'Dispatched'), COALESCE(p_record->>'dispatchDate', ''), p_record, NOW())
    ON CONFLICT (id) DO UPDATE SET
      member_id = EXCLUDED.member_id, status = EXCLUDED.status, dispatch_date = EXCLUDED.dispatch_date, data = EXCLUDED.data, updated_at = NOW();

  ELSIF p_entity = 'mutualAid' THEN
    INSERT INTO public.ada_mutual_aid (id, member_id, status, date, data, updated_at)
    VALUES (v_id, p_record->>'memberId', COALESCE(p_record->>'status', 'Pending'), COALESCE(p_record->>'date', ''), p_record, NOW())
    ON CONFLICT (id) DO UPDATE SET
      member_id = EXCLUDED.member_id, status = EXCLUDED.status, date = EXCLUDED.date, data = EXCLUDED.data, updated_at = NOW();

  ELSIF p_entity = 'incidents' THEN
    INSERT INTO public.ada_incidents (id, member_id, status, date, data, updated_at)
    VALUES (v_id, p_record->>'memberId', COALESCE(p_record->>'status', 'Open'), COALESCE(p_record->>'date', ''), p_record, NOW())
    ON CONFLICT (id) DO UPDATE SET
      member_id = EXCLUDED.member_id, status = EXCLUDED.status, date = EXCLUDED.date, data = EXCLUDED.data, updated_at = NOW();

  ELSIF p_entity = 'settings' THEN
    INSERT INTO public.ada_settings (id, data, updated_at)
    VALUES ('primary', public._ada_public_settings(p_record), NOW())
    ON CONFLICT (id) DO UPDATE SET
      data = EXCLUDED.data, updated_at = NOW();
  ELSE
    RAISE EXCEPTION 'Unknown entity: %', p_entity;
  END IF;

  RETURN jsonb_build_object('success', TRUE, 'id', v_id);
END;
$$;

-- 14. Office-role reset a member's portal password back to '0000'
CREATE OR REPLACE FUNCTION public.portal_admin_reset_member_password(
  p_token TEXT,
  p_target_member_pk TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session public.ada_portal_sessions%ROWTYPE;
  v_caller public.ada_members%ROWTYPE;
  v_target public.ada_members%ROWTYPE;
  v_settings JSONB;
BEGIN
  SELECT * INTO v_session
  FROM public.ada_portal_sessions
  WHERE token = p_token AND expires_at > NOW();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unauthorized or expired session';
  END IF;

  SELECT * INTO v_caller FROM public.ada_members WHERE id = v_session.member_pk;
  SELECT data INTO v_settings FROM public.ada_settings WHERE id = 'primary';

  IF NOT FOUND OR NOT public._ada_is_full_access_role(v_caller.role, v_settings) THEN
    RAISE EXCEPTION 'Forbidden: Office role required';
  END IF;

  SELECT * INTO v_target FROM public.ada_members WHERE id = p_target_member_pk;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  INSERT INTO public.ada_member_credentials (member_pk, member_code, password_hash, must_change_password, updated_at)
  VALUES (v_target.id, v_target.member_id, crypt('0000', gen_salt('bf')), TRUE, NOW())
  ON CONFLICT (member_pk) DO UPDATE SET
    password_hash = crypt('0000', gen_salt('bf')),
    must_change_password = TRUE,
    updated_at = NOW();

  RETURN jsonb_build_object('success', TRUE);
END;
$$;

-- 15. Offline Desktop App -> Supabase Sync Push (verifies office sync key)
CREATE OR REPLACE FUNCTION public.office_sync_push(
  p_sync_key TEXT,
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_cfg public.ada_sync_config%ROWTYPE;
  v_rec JSONB;
  v_reset_id TEXT;
  v_count INT := 0;
BEGIN
  IF LENGTH(TRIM(COALESCE(p_sync_key, ''))) < 6 THEN
    RAISE EXCEPTION 'Office Sync Secret must be at least 6 characters';
  END IF;

  SELECT * INTO v_cfg FROM public.ada_sync_config WHERE id = 'primary';
  IF NOT FOUND THEN
    INSERT INTO public.ada_sync_config (id, sync_key_hash, updated_at)
    VALUES ('primary', crypt(p_sync_key, gen_salt('bf')), NOW());
  ELSIF crypt(p_sync_key, v_cfg.sync_key_hash) <> v_cfg.sync_key_hash THEN
    RAISE EXCEPTION 'Invalid Office Sync Secret';
  END IF;

  IF p_payload ? 'settings' AND jsonb_typeof(p_payload->'settings') = 'object' THEN
    INSERT INTO public.ada_settings (id, data, updated_at)
    VALUES ('primary', public._ada_public_settings(p_payload->'settings'), NOW())
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();
    v_count := v_count + 1;
  END IF;

  IF p_payload ? 'members' AND jsonb_typeof(p_payload->'members') = 'array' THEN
    FOR v_rec IN SELECT * FROM jsonb_array_elements(p_payload->'members') LOOP
      INSERT INTO public.ada_members (id, member_id, role, status, deleted_at, data, updated_at)
      VALUES (
        v_rec->>'id',
        v_rec->>'memberId',
        COALESCE(v_rec->>'role', 'Member'),
        COALESCE(v_rec->>'status', 'Active'),
        v_rec->>'deletedAt',
        v_rec,
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        member_id = EXCLUDED.member_id,
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        deleted_at = EXCLUDED.deleted_at,
        data = EXCLUDED.data,
        updated_at = NOW();

      INSERT INTO public.ada_member_credentials (member_pk, member_code, password_hash, must_change_password)
      VALUES (v_rec->>'id', v_rec->>'memberId', crypt('0000', gen_salt('bf')), TRUE)
      ON CONFLICT (member_pk) DO UPDATE SET
        member_code = EXCLUDED.member_code;

      v_count := v_count + 1;
    END LOOP;
  END IF;

  IF p_payload ? 'payments' AND jsonb_typeof(p_payload->'payments') = 'array' THEN
    FOR v_rec IN SELECT * FROM jsonb_array_elements(p_payload->'payments') LOOP
      INSERT INTO public.ada_payments (id, member_id, status, date, data, updated_at)
      VALUES (v_rec->>'id', v_rec->>'memberId', COALESCE(v_rec->>'status', 'Pending'), COALESCE(v_rec->>'date', ''), v_rec, NOW())
      ON CONFLICT (id) DO UPDATE SET
        member_id = EXCLUDED.member_id, status = EXCLUDED.status, date = EXCLUDED.date, data = EXCLUDED.data, updated_at = NOW();
      v_count := v_count + 1;
    END LOOP;
  END IF;

  IF p_payload ? 'penalties' AND jsonb_typeof(p_payload->'penalties') = 'array' THEN
    FOR v_rec IN SELECT * FROM jsonb_array_elements(p_payload->'penalties') LOOP
      INSERT INTO public.ada_penalties (id, member_id, status, date, data, updated_at)
      VALUES (v_rec->>'id', v_rec->>'memberId', COALESCE(v_rec->>'status', 'Unpaid'), COALESCE(v_rec->>'date', ''), v_rec, NOW())
      ON CONFLICT (id) DO UPDATE SET
        member_id = EXCLUDED.member_id, status = EXCLUDED.status, date = EXCLUDED.date, data = EXCLUDED.data, updated_at = NOW();
      v_count := v_count + 1;
    END LOOP;
  END IF;

  IF p_payload ? 'expenses' AND jsonb_typeof(p_payload->'expenses') = 'array' THEN
    FOR v_rec IN SELECT * FROM jsonb_array_elements(p_payload->'expenses') LOOP
      INSERT INTO public.ada_expenses (id, date, data, updated_at)
      VALUES (v_rec->>'id', COALESCE(v_rec->>'date', ''), v_rec, NOW())
      ON CONFLICT (id) DO UPDATE SET
        date = EXCLUDED.date, data = EXCLUDED.data, updated_at = NOW();
      v_count := v_count + 1;
    END LOOP;
  END IF;

  IF p_payload ? 'trips' AND jsonb_typeof(p_payload->'trips') = 'array' THEN
    FOR v_rec IN SELECT * FROM jsonb_array_elements(p_payload->'trips') LOOP
      INSERT INTO public.ada_trips (id, member_id, status, dispatch_date, data, updated_at)
      VALUES (v_rec->>'id', v_rec->>'memberId', COALESCE(v_rec->>'status', 'Dispatched'), COALESCE(v_rec->>'dispatchDate', ''), v_rec, NOW())
      ON CONFLICT (id) DO UPDATE SET
        member_id = EXCLUDED.member_id, status = EXCLUDED.status, dispatch_date = EXCLUDED.dispatch_date, data = EXCLUDED.data, updated_at = NOW();
      v_count := v_count + 1;
    END LOOP;
  END IF;

  IF p_payload ? 'mutualAid' AND jsonb_typeof(p_payload->'mutualAid') = 'array' THEN
    FOR v_rec IN SELECT * FROM jsonb_array_elements(p_payload->'mutualAid') LOOP
      INSERT INTO public.ada_mutual_aid (id, member_id, status, date, data, updated_at)
      VALUES (v_rec->>'id', v_rec->>'memberId', COALESCE(v_rec->>'status', 'Pending'), COALESCE(v_rec->>'date', ''), v_rec, NOW())
      ON CONFLICT (id) DO UPDATE SET
        member_id = EXCLUDED.member_id, status = EXCLUDED.status, date = EXCLUDED.date, data = EXCLUDED.data, updated_at = NOW();
      v_count := v_count + 1;
    END LOOP;
  END IF;

  IF p_payload ? 'incidents' AND jsonb_typeof(p_payload->'incidents') = 'array' THEN
    FOR v_rec IN SELECT * FROM jsonb_array_elements(p_payload->'incidents') LOOP
      INSERT INTO public.ada_incidents (id, member_id, status, date, data, updated_at)
      VALUES (v_rec->>'id', v_rec->>'memberId', COALESCE(v_rec->>'status', 'Open'), COALESCE(v_rec->>'date', ''), v_rec, NOW())
      ON CONFLICT (id) DO UPDATE SET
        member_id = EXCLUDED.member_id, status = EXCLUDED.status, date = EXCLUDED.date, data = EXCLUDED.data, updated_at = NOW();
      v_count := v_count + 1;
    END LOOP;
  END IF;

  IF p_payload ? 'resetPasswordMemberIds' AND jsonb_typeof(p_payload->'resetPasswordMemberIds') = 'array' THEN
    FOR v_reset_id IN SELECT * FROM jsonb_array_elements_text(p_payload->'resetPasswordMemberIds') LOOP
      UPDATE public.ada_member_credentials
      SET
        password_hash = crypt('0000', gen_salt('bf')),
        must_change_password = TRUE,
        updated_at = NOW()
      WHERE member_pk = v_reset_id;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', TRUE, 'syncedCount', v_count, 'syncedAt', NOW());
END;
$$;

-- 16. Offline Desktop App <- Supabase Sync Pull
CREATE OR REPLACE FUNCTION public.office_sync_pull(p_sync_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_cfg public.ada_sync_config%ROWTYPE;
BEGIN
  SELECT * INTO v_cfg FROM public.ada_sync_config WHERE id = 'primary';
  IF NOT FOUND OR crypt(COALESCE(p_sync_key, ''), v_cfg.sync_key_hash) <> v_cfg.sync_key_hash THEN
    RAISE EXCEPTION 'Invalid Office Sync Secret';
  END IF;

  RETURN jsonb_build_object(
    'settings', (SELECT data FROM public.ada_settings WHERE id = 'primary'),
    'members', COALESCE((SELECT jsonb_agg(data ORDER BY member_id) FROM public.ada_members), '[]'::jsonb),
    'payments', COALESCE((SELECT jsonb_agg(data ORDER BY date DESC) FROM public.ada_payments), '[]'::jsonb),
    'penalties', COALESCE((SELECT jsonb_agg(data ORDER BY date DESC) FROM public.ada_penalties), '[]'::jsonb),
    'expenses', COALESCE((SELECT jsonb_agg(data ORDER BY date DESC) FROM public.ada_expenses), '[]'::jsonb),
    'trips', COALESCE((SELECT jsonb_agg(data ORDER BY dispatch_date DESC) FROM public.ada_trips), '[]'::jsonb),
    'mutualAid', COALESCE((SELECT jsonb_agg(data ORDER BY date DESC) FROM public.ada_mutual_aid), '[]'::jsonb),
    'incidents', COALESCE((SELECT jsonb_agg(data ORDER BY date DESC) FROM public.ada_incidents), '[]'::jsonb),
    'pulledAt', NOW()
  );
END;
$$;

-- 17. Grant execute permissions for Supabase anon/authenticated RPC calls
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_public_branding() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_login(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_change_password(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_logout(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_get_workspace(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_admin_mutate(TEXT, TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_admin_reset_member_password(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.office_sync_push(TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.office_sync_pull(TEXT) TO anon, authenticated;
