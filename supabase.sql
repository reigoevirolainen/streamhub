-- =========================================================
-- STREAMHUB V8 DATABASE
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
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS live_video_id text;
ALTER TABLE public.streamers DROP CONSTRAINT IF EXISTS streamers_platform_check;
ALTER TABLE public.streamers ADD CONSTRAINT streamers_platform_check CHECK (platform IN ('Twitch','YouTube','Kick','TikTok'));
ALTER TABLE public.streamers ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.streamers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.streamers TO authenticated;
GRANT ALL ON public.streamers TO service_role;

DROP POLICY IF EXISTS "Anyone can view streamers" ON public.streamers;
DROP POLICY IF EXISTS "Admin can add streamers" ON public.streamers;
DROP POLICY IF EXISTS "Admin can update streamers" ON public.streamers;
DROP POLICY IF EXISTS "Admin can delete streamers" ON public.streamers;
CREATE POLICY "Anyone can view streamers" ON public.streamers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin can add streamers" ON public.streamers FOR INSERT TO authenticated WITH CHECK (auth.uid()='56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid);
CREATE POLICY "Admin can update streamers" ON public.streamers FOR UPDATE TO authenticated USING (auth.uid()='56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid) WITH CHECK (auth.uid()='56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid);
CREATE POLICY "Admin can delete streamers" ON public.streamers FOR DELETE TO authenticated USING (auth.uid()='56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid);

-- Remove every old signature that caused the V6/V7 RPC mismatch.
DROP FUNCTION IF EXISTS public.admin_add_streamer(text,text,text,text,text,text,integer);
DROP FUNCTION IF EXISTS public.admin_add_streamer(text,text,text,text,text);
CREATE FUNCTION public.admin_add_streamer(p_avatar_url text,p_channel_url text,p_game text,p_name text,p_platform text)
RETURNS public.streamers LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE new_streamer public.streamers;
BEGIN
  IF auth.uid() IS NULL OR auth.uid()<>'56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid THEN RAISE EXCEPTION 'Sul puuduvad adminiõigused'; END IF;
  IF NULLIF(trim(p_name),'') IS NULL THEN RAISE EXCEPTION 'Striimeri nimi on kohustuslik'; END IF;
  IF NULLIF(trim(p_channel_url),'') IS NULL THEN RAISE EXCEPTION 'Kanali URL on kohustuslik'; END IF;
  IF p_platform NOT IN ('Twitch','YouTube','Kick','TikTok') THEN RAISE EXCEPTION 'Lubatud platvormid: Twitch, YouTube, Kick, TikTok'; END IF;
  INSERT INTO public.streamers(name,platform,channel_url,game,avatar_url,thumbnail_url,live_video_id,is_live,viewers)
  VALUES(trim(p_name),p_platform,trim(p_channel_url),NULLIF(trim(COALESCE(p_game,'')),''),NULLIF(trim(COALESCE(p_avatar_url,'')),''),NULL,NULL,false,0)
  RETURNING * INTO new_streamer;
  RETURN new_streamer;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_add_streamer(text,text,text,text,text) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.streamer_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, platform text NOT NULL,
  channel_url text NOT NULL, email text NOT NULL, message text, status text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.streamer_applications DROP CONSTRAINT IF EXISTS streamer_applications_platform_check;
ALTER TABLE public.streamer_applications ADD CONSTRAINT streamer_applications_platform_check CHECK(platform IN ('Twitch','YouTube','Kick','TikTok'));
ALTER TABLE public.streamer_applications DROP CONSTRAINT IF EXISTS streamer_applications_status_check;
ALTER TABLE public.streamer_applications ADD CONSTRAINT streamer_applications_status_check CHECK(status IN ('pending','approved','rejected'));
ALTER TABLE public.streamer_applications ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON public.streamer_applications TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.streamer_applications TO authenticated;
GRANT ALL ON public.streamer_applications TO service_role;
DROP POLICY IF EXISTS "Anyone can submit streamer applications" ON public.streamer_applications;
DROP POLICY IF EXISTS "Admin can view applications" ON public.streamer_applications;
DROP POLICY IF EXISTS "Admin can update applications" ON public.streamer_applications;
DROP POLICY IF EXISTS "Admin can delete applications" ON public.streamer_applications;
CREATE POLICY "Anyone can submit streamer applications" ON public.streamer_applications FOR INSERT TO anon,authenticated WITH CHECK(length(trim(name)) BETWEEN 2 AND 80 AND length(trim(email)) BETWEEN 5 AND 254 AND length(trim(channel_url)) BETWEEN 8 AND 500);
CREATE POLICY "Admin can view applications" ON public.streamer_applications FOR SELECT TO authenticated USING(auth.uid()='56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid);
CREATE POLICY "Admin can update applications" ON public.streamer_applications FOR UPDATE TO authenticated USING(auth.uid()='56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid) WITH CHECK(auth.uid()='56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid);
CREATE POLICY "Admin can delete applications" ON public.streamer_applications FOR DELETE TO authenticated USING(auth.uid()='56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid);

NOTIFY pgrst,'reload schema';
SELECT pg_notify('pgrst','reload schema');
SELECT n.nspname schema_name,p.proname function_name,p.pronargs parameter_count,pg_get_function_identity_arguments(p.oid) arguments,pg_get_function_result(p.oid) return_type FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='admin_add_streamer';
