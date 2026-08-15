-- StreamHub v4 database setup / migration
-- Run in Supabase SQL Editor with "Run as: postgres".

GRANT USAGE ON SCHEMA public TO postgres;
GRANT CREATE ON SCHEMA public TO postgres;

CREATE TABLE IF NOT EXISTS public.streamers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  platform text NOT NULL,
  channel_url text NOT NULL,
  game text,
  avatar_url text,
  thumbnail_url text,
  is_live boolean NOT NULL DEFAULT false,
  viewers integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.streamers
DROP CONSTRAINT IF EXISTS streamers_platform_check;

ALTER TABLE public.streamers
ADD CONSTRAINT streamers_platform_check
CHECK (platform IN ('Twitch','YouTube','Kick','TikTok'));

ALTER TABLE public.streamers ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.streamers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.streamers TO authenticated;

DROP POLICY IF EXISTS "Anyone can view streamers" ON public.streamers;
CREATE POLICY "Anyone can view streamers"
ON public.streamers FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Admin can add streamers" ON public.streamers;
CREATE POLICY "Admin can add streamers"
ON public.streamers FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = '56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid);

DROP POLICY IF EXISTS "Admin can update streamers" ON public.streamers;
CREATE POLICY "Admin can update streamers"
ON public.streamers FOR UPDATE
TO authenticated
USING (auth.uid() = '56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid)
WITH CHECK (auth.uid() = '56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid);

DROP POLICY IF EXISTS "Admin can delete streamers" ON public.streamers;
CREATE POLICY "Admin can delete streamers"
ON public.streamers FOR DELETE
TO authenticated
USING (auth.uid() = '56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid);

-- Applications table used by + LIITU
CREATE TABLE IF NOT EXISTS public.streamer_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  platform text NOT NULL,
  channel_url text NOT NULL,
  email text NOT NULL,
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending'
);

ALTER TABLE public.streamer_applications
DROP CONSTRAINT IF EXISTS streamer_applications_platform_check;

ALTER TABLE public.streamer_applications
ADD CONSTRAINT streamer_applications_platform_check
CHECK (platform IN ('Twitch','YouTube','Kick','TikTok'));

ALTER TABLE public.streamer_applications ENABLE ROW LEVEL SECURITY;

GRANT INSERT ON public.streamer_applications TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.streamer_applications TO authenticated;

DROP POLICY IF EXISTS "Anyone can submit streamer applications" ON public.streamer_applications;
CREATE POLICY "Anyone can submit streamer applications"
ON public.streamer_applications FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(name) BETWEEN 2 AND 80
  AND length(email) BETWEEN 5 AND 254
  AND length(channel_url) BETWEEN 8 AND 500
);

DROP POLICY IF EXISTS "Admin can view applications" ON public.streamer_applications;
CREATE POLICY "Admin can view applications"
ON public.streamer_applications FOR SELECT
TO authenticated
USING (auth.uid() = '56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid);

DROP POLICY IF EXISTS "Admin can update applications" ON public.streamer_applications;
CREATE POLICY "Admin can update applications"
ON public.streamer_applications FOR UPDATE
TO authenticated
USING (auth.uid() = '56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid)
WITH CHECK (auth.uid() = '56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid);

DROP POLICY IF EXISTS "Admin can delete applications" ON public.streamer_applications;
CREATE POLICY "Admin can delete applications"
ON public.streamer_applications FOR DELETE
TO authenticated
USING (auth.uid() = '56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid);


-- =========================================================
-- 12. Robust admin INSERT RPC
-- =========================================================
-- The website calls this function instead of a direct INSERT.
-- It checks the admin UUID inside PostgreSQL and then inserts
-- with the function owner's privileges.

CREATE OR REPLACE FUNCTION public.admin_add_streamer(
    p_name text,
    p_platform text,
    p_channel_url text,
    p_game text DEFAULT NULL,
    p_avatar_url text DEFAULT NULL,
    p_thumbnail_url text DEFAULT NULL,
    p_is_live boolean DEFAULT false,
    p_viewers integer DEFAULT 0
)
RETURNS public.streamers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_streamer public.streamers;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Sa pead olema sisse logitud';
    END IF;

    IF auth.uid() <> '56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid THEN
        RAISE EXCEPTION 'Sul puuduvad adminiõigused';
    END IF;

    IF trim(coalesce(p_name, '')) = '' THEN
        RAISE EXCEPTION 'Striimeri nimi on kohustuslik';
    END IF;

    IF p_platform NOT IN ('Twitch','YouTube','Kick','TikTok') THEN
        RAISE EXCEPTION 'Tundmatu platvorm: %', p_platform;
    END IF;

    IF trim(coalesce(p_channel_url, '')) = '' THEN
        RAISE EXCEPTION 'Kanali URL on kohustuslik';
    END IF;

    INSERT INTO public.streamers (
        name, platform, channel_url, game,
        avatar_url, thumbnail_url, is_live, viewers, updated_at
    )
    VALUES (
        trim(p_name),
        p_platform,
        trim(p_channel_url),
        NULLIF(trim(coalesce(p_game, '')), ''),
        NULLIF(trim(coalesce(p_avatar_url, '')), ''),
        NULLIF(trim(coalesce(p_thumbnail_url, '')), ''),
        coalesce(p_is_live, false),
        greatest(coalesce(p_viewers, 0), 0),
        now()
    )
    RETURNING * INTO new_streamer;

    RETURN new_streamer;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_add_streamer(
    text,text,text,text,text,text,boolean,integer
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_add_streamer(
    text,text,text,text,text,text,boolean,integer
) TO authenticated;
