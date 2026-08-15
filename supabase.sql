-- =========================================================
-- STREAMHUB V10 FINAL DATABASE
-- =========================================================
-- Website RPC: admin_add_streamer = EXACTLY 5 params
-- Sync RPC: sync_streamer_status = 7 params
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, postgres;
GRANT CREATE ON SCHEMA public TO postgres;

CREATE TABLE IF NOT EXISTS public.streamers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  platform text NOT NULL,
  channel_url text NOT NULL,
  game text,
  avatar_url text,
  thumbnail_url text,
  live_video_id text,
  is_live boolean NOT NULL DEFAULT false,
  viewers integer NOT NULL DEFAULT 0,
  last_checked_at timestamptz,
  last_live_at timestamptz,
  sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS game text;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS thumbnail_url text;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS live_video_id text;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS is_live boolean DEFAULT false;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS viewers integer DEFAULT 0;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS last_checked_at timestamptz;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS last_live_at timestamptz;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS sync_error text;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.streamers DROP CONSTRAINT IF EXISTS streamers_platform_check;
ALTER TABLE public.streamers ADD CONSTRAINT streamers_platform_check
CHECK (platform IN ('Twitch','YouTube','Kick','TikTok'));

ALTER TABLE public.streamers DROP CONSTRAINT IF EXISTS streamers_viewers_check;
ALTER TABLE public.streamers ADD CONSTRAINT streamers_viewers_check CHECK (viewers >= 0);

CREATE OR REPLACE FUNCTION public.streamers_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS streamers_updated_at ON public.streamers;
CREATE TRIGGER streamers_updated_at
BEFORE UPDATE ON public.streamers
FOR EACH ROW EXECUTE FUNCTION public.streamers_set_updated_at();

ALTER TABLE public.streamers ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.streamers TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.streamers TO authenticated;
GRANT ALL ON public.streamers TO service_role;

DROP POLICY IF EXISTS "Anyone can view streamers" ON public.streamers;
DROP POLICY IF EXISTS "Admin can add streamers" ON public.streamers;
DROP POLICY IF EXISTS "Admin can update streamers" ON public.streamers;
DROP POLICY IF EXISTS "Admin can delete streamers" ON public.streamers;

CREATE POLICY "Anyone can view streamers"
ON public.streamers FOR SELECT TO anon,authenticated USING (true);

CREATE POLICY "Admin can add streamers"
ON public.streamers FOR INSERT TO authenticated
WITH CHECK (auth.uid()='56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid);

CREATE POLICY "Admin can update streamers"
ON public.streamers FOR UPDATE TO authenticated
USING (auth.uid()='56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid)
WITH CHECK (auth.uid()='56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid);

CREATE POLICY "Admin can delete streamers"
ON public.streamers FOR DELETE TO authenticated
USING (auth.uid()='56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid);

-- Remove every old RPC signature that caused the previous errors.
DROP FUNCTION IF EXISTS public.admin_add_streamer(text,text,text,text);
DROP FUNCTION IF EXISTS public.admin_add_streamer(text,text,text,text,text,text);
DROP FUNCTION IF EXISTS public.admin_add_streamer(text,text,text,text,text,text,integer);

CREATE FUNCTION public.admin_add_streamer(
  p_avatar_url text,
  p_channel_url text,
  p_game text,
  p_name text,
  p_platform text
)
RETURNS public.streamers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE r public.streamers;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Kasutaja ei ole sisse logitud'; END IF;
  IF auth.uid() <> '56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid THEN RAISE EXCEPTION 'Sul puuduvad adminiõigused'; END IF;
  IF NULLIF(trim(p_name),'') IS NULL THEN RAISE EXCEPTION 'Striimeri nimi on kohustuslik'; END IF;
  IF NULLIF(trim(p_channel_url),'') IS NULL THEN RAISE EXCEPTION 'Kanali URL on kohustuslik'; END IF;
  IF p_platform NOT IN ('Twitch','YouTube','Kick','TikTok') THEN RAISE EXCEPTION 'Tundmatu platvorm'; END IF;

  INSERT INTO public.streamers
    (name,platform,channel_url,game,avatar_url,is_live,viewers,created_at,updated_at)
  VALUES
    (trim(p_name),p_platform,trim(p_channel_url),
     NULLIF(trim(coalesce(p_game,'')),''),
     NULLIF(trim(coalesce(p_avatar_url,'')),''),
     false,0,now(),now())
  RETURNING * INTO r;
  RETURN r;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_add_streamer(text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_streamer(text,text,text,text,text) TO service_role;

DROP FUNCTION IF EXISTS public.sync_streamer_status(uuid,boolean,integer,text,text,text);
DROP FUNCTION IF EXISTS public.sync_streamer_status(uuid,boolean,integer,text,text,text,text);

CREATE FUNCTION public.sync_streamer_status(
  p_id uuid,
  p_is_live boolean,
  p_viewers integer,
  p_game text DEFAULT NULL,
  p_thumbnail_url text DEFAULT NULL,
  p_live_video_id text DEFAULT NULL,
  p_error text DEFAULT NULL
)
RETURNS public.streamers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE r public.streamers;
BEGIN
  UPDATE public.streamers
  SET
    is_live=coalesce(p_is_live,false),
    viewers=greatest(coalesce(p_viewers,0),0),
    game=CASE WHEN p_game IS NOT NULL AND trim(p_game)<>'' THEN trim(p_game) ELSE game END,
    thumbnail_url=CASE WHEN p_thumbnail_url IS NOT NULL AND trim(p_thumbnail_url)<>'' THEN p_thumbnail_url ELSE thumbnail_url END,
    live_video_id=CASE WHEN p_is_live THEN nullif(trim(coalesce(p_live_video_id,'')),'') ELSE NULL END,
    sync_error=p_error,
    last_checked_at=now(),
    last_live_at=CASE WHEN p_is_live THEN now() ELSE last_live_at END,
    updated_at=now()
  WHERE id=p_id
  RETURNING * INTO r;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Striimerit ei leitud: %',p_id; END IF;
  RETURN r;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_streamer_status(uuid,boolean,integer,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sync_streamer_status(uuid,boolean,integer,text,text,text,text) TO service_role;

CREATE TABLE IF NOT EXISTS public.streamer_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  platform text NOT NULL,
  channel_url text NOT NULL,
  email text NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.streamer_applications DROP CONSTRAINT IF EXISTS streamer_applications_platform_check;
ALTER TABLE public.streamer_applications ADD CONSTRAINT streamer_applications_platform_check
CHECK (platform IN ('Twitch','YouTube','Kick','TikTok'));

ALTER TABLE public.streamer_applications DROP CONSTRAINT IF EXISTS streamer_applications_status_check;
ALTER TABLE public.streamer_applications ADD CONSTRAINT streamer_applications_status_check
CHECK (status IN ('pending','approved','rejected'));

ALTER TABLE public.streamer_applications ENABLE ROW LEVEL SECURITY;

GRANT INSERT ON public.streamer_applications TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.streamer_applications TO authenticated;
GRANT ALL ON public.streamer_applications TO service_role;

DROP POLICY IF EXISTS "Anyone can submit streamer applications" ON public.streamer_applications;
DROP POLICY IF EXISTS "Admin can view applications" ON public.streamer_applications;
DROP POLICY IF EXISTS "Admin can update applications" ON public.streamer_applications;
DROP POLICY IF EXISTS "Admin can delete applications" ON public.streamer_applications;

CREATE POLICY "Anyone can submit streamer applications"
ON public.streamer_applications FOR INSERT TO anon,authenticated
WITH CHECK (
  length(trim(name)) BETWEEN 2 AND 80
  AND length(trim(email)) BETWEEN 5 AND 254
  AND length(trim(channel_url)) BETWEEN 8 AND 500
);

CREATE POLICY "Admin can view applications"
ON public.streamer_applications FOR SELECT TO authenticated
USING (auth.uid()='56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid);

CREATE POLICY "Admin can update applications"
ON public.streamer_applications FOR UPDATE TO authenticated
USING (auth.uid()='56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid)
WITH CHECK (auth.uid()='56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid);

CREATE POLICY "Admin can delete applications"
ON public.streamer_applications FOR DELETE TO authenticated
USING (auth.uid()='56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid);

NOTIFY pgrst,'reload schema';
SELECT pg_notify('pgrst','reload schema');

-- Must show parameter_count = 5.
SELECT n.nspname schema_name,p.proname function_name,p.pronargs parameter_count,
pg_get_function_identity_arguments(p.oid) arguments,pg_get_function_result(p.oid) return_type
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='admin_add_streamer';

-- Must show parameter_count = 7.
SELECT n.nspname schema_name,p.proname function_name,p.pronargs parameter_count,
pg_get_function_identity_arguments(p.oid) arguments,pg_get_function_result(p.oid) return_type
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='sync_streamer_status';
