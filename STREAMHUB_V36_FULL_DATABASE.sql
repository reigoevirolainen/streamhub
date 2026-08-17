-- ============================================================
-- STREAMHUB V36 FINAL DATABASE
-- ============================================================
-- PURPOSE
-- Complete database foundation for StreamHub V36.
--
-- IMPORTANT:
-- 1) Run this entire script in a NEW Supabase SQL query.
-- 2) It is designed to repair/extend the existing StreamHub database.
-- 3) It does NOT delete auth.users, profiles, applications or streamers.
-- 4) The streamer application password MUST NOT be stored in SQL.
--    The V36 Edge Function receives it and uses Supabase Auth to create
--    the account after admin approval.
-- 5) Viewers are intentionally NOT user-editable.
-- 6) Public users can submit applications through the RPC.
-- 7) Admin-only actions are protected by is_admin().
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. PROFILES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username text,
    email text,
    display_name text,
    avatar_url text,
    user_type text NOT NULL DEFAULT 'streamer',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_type text DEFAULT 'streamer';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.profiles SET user_type = 'streamer' WHERE user_type IS NULL;
UPDATE public.profiles SET created_at = now() WHERE created_at IS NULL;
UPDATE public.profiles SET updated_at = now() WHERE updated_at IS NULL;

-- Never allow arbitrary roles.
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_user_type_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_user_type_check
CHECK (user_type IN ('streamer', 'admin'));

-- ============================================================
-- 2. STREAMER APPLICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.streamer_applications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text,
    email text,
    platform text,
    channel_url text,
    game text,
    avatar_url text,
    thumbnail_url text,
    message text,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    approved_at timestamptz,
    approved_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.streamer_applications ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.streamer_applications ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.streamer_applications ADD COLUMN IF NOT EXISTS platform text;
ALTER TABLE public.streamer_applications ADD COLUMN IF NOT EXISTS channel_url text;
ALTER TABLE public.streamer_applications ADD COLUMN IF NOT EXISTS game text;
ALTER TABLE public.streamer_applications ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.streamer_applications ADD COLUMN IF NOT EXISTS thumbnail_url text;
ALTER TABLE public.streamer_applications ADD COLUMN IF NOT EXISTS message text;
ALTER TABLE public.streamer_applications ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE public.streamer_applications ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.streamer_applications ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.streamer_applications ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE public.streamer_applications ADD COLUMN IF NOT EXISTS approved_by uuid;

UPDATE public.streamer_applications SET status = 'pending' WHERE status IS NULL;
UPDATE public.streamer_applications SET created_at = now() WHERE created_at IS NULL;
UPDATE public.streamer_applications SET updated_at = now() WHERE updated_at IS NULL;

ALTER TABLE public.streamer_applications
DROP CONSTRAINT IF EXISTS streamer_applications_platform_check;

ALTER TABLE public.streamer_applications
ADD CONSTRAINT streamer_applications_platform_check
CHECK (platform IS NULL OR platform IN ('Twitch','YouTube','Kick','TikTok'));

ALTER TABLE public.streamer_applications
DROP CONSTRAINT IF EXISTS streamer_applications_status_check;

ALTER TABLE public.streamer_applications
ADD CONSTRAINT streamer_applications_status_check
CHECK (status IN ('pending','approved','rejected'));

-- ============================================================
-- 3. STREAMERS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.streamers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    platform text,
    channel_url text,
    game text,
    avatar_url text,
    thumbnail_url text,
    owner_id uuid,
    owner_email text,
    is_live boolean NOT NULL DEFAULT false,
    manual_live boolean NOT NULL DEFAULT false,
    viewers integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS platform text;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS channel_url text;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS game text;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS thumbnail_url text;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS owner_email text;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS is_live boolean DEFAULT false;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS manual_live boolean DEFAULT false;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS viewers integer DEFAULT 0;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.streamers SET is_live = false WHERE is_live IS NULL;
UPDATE public.streamers SET manual_live = false WHERE manual_live IS NULL;
UPDATE public.streamers SET viewers = 0 WHERE viewers IS NULL;
UPDATE public.streamers SET created_at = now() WHERE created_at IS NULL;
UPDATE public.streamers SET updated_at = now() WHERE updated_at IS NULL;

-- Viewer counts cannot be negative.
ALTER TABLE public.streamers
DROP CONSTRAINT IF EXISTS streamers_viewers_nonnegative_check;

ALTER TABLE public.streamers
ADD CONSTRAINT streamers_viewers_nonnegative_check
CHECK (viewers >= 0);

-- ============================================================
-- 4. AUTH -> PROFILE AUTOMATIC CREATION
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        username,
        email,
        display_name,
        avatar_url,
        user_type
    )
    VALUES (
        NEW.id,
        COALESCE(
            NULLIF(NEW.raw_user_meta_data->>'username', ''),
            split_part(COALESCE(NEW.email, ''), '@', 1)
        ),
        NEW.email,
        NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
        NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''),
        COALESCE(
            NULLIF(NEW.raw_user_meta_data->>'user_type', ''),
            'streamer'
        )
    )
    ON CONFLICT (id) DO UPDATE
    SET
        email = COALESCE(public.profiles.email, EXCLUDED.email),
        username = COALESCE(public.profiles.username, EXCLUDED.username);

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 5. TIMESTAMP TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_profile_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;

CREATE TRIGGER profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_profile_timestamp();

CREATE OR REPLACE FUNCTION public.update_streamer_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS streamers_updated_at ON public.streamers;

CREATE TRIGGER streamers_updated_at
BEFORE UPDATE ON public.streamers
FOR EACH ROW
EXECUTE FUNCTION public.update_streamer_timestamp();

CREATE OR REPLACE FUNCTION public.update_application_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS streamer_applications_updated_at
ON public.streamer_applications;

CREATE TRIGGER streamer_applications_updated_at
BEFORE UPDATE ON public.streamer_applications
FOR EACH ROW
EXECUTE FUNCTION public.update_application_timestamp();

-- ============================================================
-- 6. ADMIN CHECK
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND user_type = 'admin'
    );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ============================================================
-- 7. STREAMER CHECK
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_streamer()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND user_type = 'streamer'
    );
$$;

REVOKE ALL ON FUNCTION public.is_streamer() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_streamer() TO authenticated;

-- ============================================================
-- 8. RLS ENABLE
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streamer_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streamers ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 9. REMOVE OLD / CONFLICTING POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Public can submit applications"
ON public.streamer_applications;

DROP POLICY IF EXISTS "public submit applications"
ON public.streamer_applications;

DROP POLICY IF EXISTS "Anyone can submit application"
ON public.streamer_applications;

DROP POLICY IF EXISTS "Anyone can submit streamer application"
ON public.streamer_applications;

DROP POLICY IF EXISTS "Admins can read applications"
ON public.streamer_applications;

DROP POLICY IF EXISTS "Admins can view applications"
ON public.streamer_applications;

DROP POLICY IF EXISTS "Admins can update applications"
ON public.streamer_applications;

DROP POLICY IF EXISTS "Anyone can view streamers"
ON public.streamers;

DROP POLICY IF EXISTS "public read streamers"
ON public.streamers;

DROP POLICY IF EXISTS "Streamer can update own row"
ON public.streamers;

DROP POLICY IF EXISTS "Users can view own profile"
ON public.profiles;

DROP POLICY IF EXISTS "Public profiles are viewable"
ON public.profiles;

DROP POLICY IF EXISTS "Users can create own profile"
ON public.profiles;

DROP POLICY IF EXISTS "Users can update own profile"
ON public.profiles;

DROP POLICY IF EXISTS "Users can delete own profile"
ON public.profiles;

DROP POLICY IF EXISTS "Admins can manage profiles"
ON public.profiles;

-- ============================================================
-- 10. PUBLIC STREAMER READ
-- ============================================================

CREATE POLICY "Anyone can view streamers"
ON public.streamers
FOR SELECT
TO anon, authenticated
USING (true);

-- ============================================================
-- 11. PUBLIC PROFILE READ
-- ============================================================

CREATE POLICY "Public profiles are viewable"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (true);

-- ============================================================
-- 12. PROFILE INSERT - OWN ACCOUNT ONLY
-- ============================================================

CREATE POLICY "Users can create own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
    id = auth.uid()
    AND user_type = 'streamer'
);

-- ============================================================
-- 13. PROFILE UPDATE - OWN USERNAME/SAFE PROFILE FIELDS
-- ============================================================
-- The application should only expose username/profile fields.
-- Role cannot be changed by the user.

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
    id = auth.uid()
    AND user_type = (
        SELECT p.user_type
        FROM public.profiles p
        WHERE p.id = auth.uid()
    )
);

-- ============================================================
-- 14. STREAMER UPDATE POLICY
-- ============================================================
-- IMPORTANT:
-- A streamer may update their own public profile/live state.
-- viewers is NOT included in the UPDATE grant below.
-- The database also blocks non-admin attempts to alter viewers.

CREATE OR REPLACE FUNCTION public.protect_streamer_viewers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NOT NULL
       AND NOT public.is_admin()
       AND NEW.viewers IS DISTINCT FROM OLD.viewers THEN
        RAISE EXCEPTION 'Streamer cannot change viewer count';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_streamer_viewers
ON public.streamers;

CREATE TRIGGER protect_streamer_viewers
BEFORE UPDATE ON public.streamers
FOR EACH ROW
EXECUTE FUNCTION public.protect_streamer_viewers();

CREATE POLICY "Streamer can update own row"
ON public.streamers
FOR UPDATE
TO authenticated
USING (
    owner_id = auth.uid()
)
WITH CHECK (
    owner_id = auth.uid()
);

-- ============================================================
-- 15. ADMIN READ APPLICATIONS
-- ============================================================

CREATE POLICY "Admins can read applications"
ON public.streamer_applications
FOR SELECT
TO authenticated
USING (public.is_admin());

-- ============================================================
-- 16. ADMIN UPDATE APPLICATIONS
-- ============================================================

CREATE POLICY "Admins can update applications"
ON public.streamer_applications
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ============================================================
-- 17. DATABASE GRANTS
-- ============================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT
ON public.streamers
TO anon, authenticated;

-- DO NOT grant UPDATE ON ALL STREAMER COLUMNS.
REVOKE UPDATE
ON public.streamers
FROM authenticated;

GRANT UPDATE (
    name,
    platform,
    channel_url,
    game,
    avatar_url,
    thumbnail_url,
    is_live,
    manual_live,
    owner_email,
    owner_id
)
ON public.streamers
TO authenticated;

GRANT SELECT
ON public.profiles
TO anon, authenticated;

REVOKE UPDATE
ON public.profiles
FROM authenticated;

GRANT UPDATE (
    username,
    display_name,
    avatar_url
)
ON public.profiles
TO authenticated;

GRANT SELECT
ON public.streamer_applications
TO authenticated;

GRANT UPDATE
ON public.streamer_applications
TO authenticated;

-- ============================================================
-- 18. PUBLIC APPLICATION RPC
-- ============================================================
-- Password is deliberately NOT stored here.
-- The Edge Function receives the password and handles Auth creation.
-- This RPC only creates the pending application.

CREATE OR REPLACE FUNCTION public.submit_streamer_application(
    p_name text,
    p_email text,
    p_platform text,
    p_channel_url text,
    p_game text DEFAULT NULL,
    p_avatar_url text DEFAULT NULL,
    p_message text DEFAULT NULL,
    p_thumbnail_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_application_id uuid;
BEGIN
    IF NULLIF(TRIM(p_name), '') IS NULL THEN
        RAISE EXCEPTION 'Striimeri nimi on kohustuslik';
    END IF;

    IF NULLIF(TRIM(p_email), '') IS NULL THEN
        RAISE EXCEPTION 'E-post on kohustuslik';
    END IF;

    IF p_platform NOT IN ('Twitch','YouTube','Kick','TikTok') THEN
        RAISE EXCEPTION 'Tundmatu platvorm';
    END IF;

    IF NULLIF(TRIM(p_channel_url), '') IS NULL THEN
        RAISE EXCEPTION 'Kanali URL on kohustuslik';
    END IF;

    INSERT INTO public.streamer_applications (
        name,
        email,
        platform,
        channel_url,
        game,
        avatar_url,
        thumbnail_url,
        message,
        status,
        created_at,
        updated_at
    )
    VALUES (
        TRIM(p_name),
        LOWER(TRIM(p_email)),
        p_platform,
        TRIM(p_channel_url),
        NULLIF(TRIM(p_game), ''),
        NULLIF(TRIM(p_avatar_url), ''),
        NULLIF(TRIM(p_thumbnail_url), ''),
        NULLIF(TRIM(p_message), ''),
        'pending',
        now(),
        now()
    )
    RETURNING id INTO new_application_id;

    RETURN new_application_id;
END;
$$;

REVOKE ALL
ON FUNCTION public.submit_streamer_application(
    text,text,text,text,text,text,text,text
)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.submit_streamer_application(
    text,text,text,text,text,text,text,text
)
TO anon, authenticated;

-- ============================================================
-- 19. ADMIN APPROVE
-- ============================================================
-- Creates the public streamer profile and marks the application
-- approved. Auth account/email notification should be performed
-- by the V36 Edge Function using the application email/password.
--
-- This function is intentionally idempotency-safe:
-- it refuses already processed applications.

CREATE OR REPLACE FUNCTION public.admin_approve_streamer(
    p_application_id uuid
)
RETURNS public.streamer_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    application_row public.streamer_applications;
    result_row public.streamer_applications;
    existing_streamer_id uuid;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin access required';
    END IF;

    SELECT *
    INTO application_row
    FROM public.streamer_applications
    WHERE id = p_application_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Application not found';
    END IF;

    IF application_row.status <> 'pending' THEN
        RAISE EXCEPTION 'Application is already processed';
    END IF;

    SELECT s.id
    INTO existing_streamer_id
    FROM public.streamers s
    WHERE LOWER(TRIM(s.owner_email)) =
          LOWER(TRIM(application_row.email))
    LIMIT 1;

    IF existing_streamer_id IS NULL THEN
        INSERT INTO public.streamers (
            name,
            platform,
            channel_url,
            game,
            avatar_url,
            thumbnail_url,
            owner_email,
            is_live,
            manual_live,
            viewers,
            updated_at
        )
        VALUES (
            application_row.name,
            application_row.platform,
            application_row.channel_url,
            application_row.game,
            application_row.avatar_url,
            application_row.thumbnail_url,
            LOWER(TRIM(application_row.email)),
            false,
            false,
            0,
            now()
        );
    END IF;

    UPDATE public.streamer_applications
    SET
        status = 'approved',
        approved_at = now(),
        approved_by = auth.uid(),
        updated_at = now()
    WHERE id = application_row.id
    RETURNING *
    INTO result_row;

    RETURN result_row;
END;
$$;

REVOKE ALL
ON FUNCTION public.admin_approve_streamer(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.admin_approve_streamer(uuid)
TO authenticated;

-- ============================================================
-- 20. ADMIN REJECT
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_reject_application(
    p_application_id uuid
)
RETURNS public.streamer_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result_row public.streamer_applications;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin access required';
    END IF;

    UPDATE public.streamer_applications
    SET
        status = 'rejected',
        approved_at = NULL,
        approved_by = auth.uid(),
        updated_at = now()
    WHERE id = p_application_id
      AND status = 'pending'
    RETURNING *
    INTO result_row;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pending application not found';
    END IF;

    RETURN result_row;
END;
$$;

REVOKE ALL
ON FUNCTION public.admin_reject_application(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.admin_reject_application(uuid)
TO authenticated;

-- ============================================================
-- 21. STREAMER CLAIMS APPROVED PROFILE
-- ============================================================

CREATE OR REPLACE FUNCTION public.claim_my_streamer()
RETURNS public.streamers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result_row public.streamers;
    user_email text;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Login required';
    END IF;

    SELECT LOWER(TRIM(email))
    INTO user_email
    FROM auth.users
    WHERE id = auth.uid();

    UPDATE public.streamers
    SET
        owner_id = auth.uid(),
        updated_at = now()
    WHERE owner_id IS NULL
      AND LOWER(TRIM(owner_email)) = user_email;

    SELECT *
    INTO result_row
    FROM public.streamers
    WHERE owner_id = auth.uid()
    ORDER BY created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Approved streamer profile not found';
    END IF;

    RETURN result_row;
END;
$$;

REVOKE ALL
ON FUNCTION public.claim_my_streamer()
FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION public.claim_my_streamer()
TO authenticated;

-- ============================================================
-- 22. STREAMER LIVE/OFFLINE RPC
-- ============================================================
-- This lets the streamer control ONLY their own live status.
-- It never accepts a viewer count.

CREATE OR REPLACE FUNCTION public.set_my_live_status(
    p_is_live boolean
)
RETURNS public.streamers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result_row public.streamers;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Login required';
    END IF;

    UPDATE public.streamers
    SET
        is_live = p_is_live,
        manual_live = true,
        updated_at = now()
    WHERE owner_id = auth.uid()
    RETURNING *
    INTO result_row;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Streamer profile not found';
    END IF;

    RETURN result_row;
END;
$$;

REVOKE ALL
ON FUNCTION public.set_my_live_status(boolean)
FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION public.set_my_live_status(boolean)
TO authenticated;

-- ============================================================
-- 23. ADMIN VIEWER COUNT RPC
-- ============================================================
-- Only admin/backend may change viewer counts.
-- The frontend streamer account cannot call this.

CREATE OR REPLACE FUNCTION public.admin_set_viewers(
    p_streamer_id uuid,
    p_viewers integer
)
RETURNS public.streamers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result_row public.streamers;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin access required';
    END IF;

    IF p_viewers < 0 THEN
        RAISE EXCEPTION 'Viewer count cannot be negative';
    END IF;

    UPDATE public.streamers
    SET
        viewers = p_viewers,
        updated_at = now()
    WHERE id = p_streamer_id
    RETURNING *
    INTO result_row;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Streamer not found';
    END IF;

    RETURN result_row;
END;
$$;

REVOKE ALL
ON FUNCTION public.admin_set_viewers(uuid,integer)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.admin_set_viewers(uuid,integer)
TO authenticated;

-- ============================================================
-- 24. ADMIN CREATE/REPAIR PROFILE
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_admin_profile(
    p_user_id uuid,
    p_username text,
    p_email text,
    p_display_name text DEFAULT NULL,
    p_avatar_url text DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result public.profiles;
BEGIN
    INSERT INTO public.profiles (
        id,
        username,
        email,
        display_name,
        avatar_url,
        user_type
    )
    VALUES (
        p_user_id,
        p_username,
        LOWER(TRIM(p_email)),
        p_display_name,
        p_avatar_url,
        'admin'
    )
    ON CONFLICT (id)
    DO UPDATE SET
        username = EXCLUDED.username,
        email = EXCLUDED.email,
        display_name = EXCLUDED.display_name,
        avatar_url = EXCLUDED.avatar_url,
        user_type = 'admin',
        updated_at = now()
    RETURNING *
    INTO result;

    RETURN result;
END;
$$;

REVOKE ALL
ON FUNCTION public.create_admin_profile(
    uuid,text,text,text,text
)
FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 25. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS streamers_game_idx
ON public.streamers(game);

CREATE INDEX IF NOT EXISTS streamers_platform_idx
ON public.streamers(platform);

CREATE INDEX IF NOT EXISTS streamers_live_idx
ON public.streamers(is_live);

CREATE INDEX IF NOT EXISTS streamers_owner_id_idx
ON public.streamers(owner_id);

CREATE INDEX IF NOT EXISTS streamers_owner_email_idx
ON public.streamers(owner_email);

CREATE INDEX IF NOT EXISTS streamers_updated_at_idx
ON public.streamers(updated_at DESC);

CREATE INDEX IF NOT EXISTS applications_status_idx
ON public.streamer_applications(status);

CREATE INDEX IF NOT EXISTS applications_created_at_idx
ON public.streamer_applications(created_at DESC);

CREATE INDEX IF NOT EXISTS applications_email_idx
ON public.streamer_applications(email);

CREATE INDEX IF NOT EXISTS profiles_user_type_idx
ON public.profiles(user_type);

-- ============================================================
-- 26. FINAL PERMISSIONS CLEANUP
-- ============================================================

REVOKE ALL
ON public.streamer_applications
FROM anon;

-- Public application creation is through the SECURITY DEFINER RPC,
-- not direct table INSERT.
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT
ON public.streamers
TO anon, authenticated;

GRANT SELECT
ON public.profiles
TO anon, authenticated;

GRANT SELECT
ON public.streamer_applications
TO authenticated;

-- ============================================================
-- 27. POSTGREST SCHEMA REFRESH
-- ============================================================

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- 28. FINAL CHECK
-- ============================================================

SELECT
    'STREAMHUB V36 FINAL DATABASE READY' AS status,
    EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'profiles'
    ) AS profiles_ready,
    EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'streamer_applications'
    ) AS applications_ready,
    EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'streamers'
    ) AS streamers_ready,
    EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname = 'handle_new_user'
    ) AS signup_trigger_function_ready,
    EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname = 'admin_approve_streamer'
    ) AS admin_approve_ready,
    EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname = 'claim_my_streamer'
    ) AS claim_ready,
    EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname = 'set_my_live_status'
    ) AS live_status_ready;
