-- =========================================================
-- STREAMHUB FULL DATABASE
-- Run in Supabase SQL Editor as postgres.
-- =========================================================

GRANT USAGE ON SCHEMA public TO postgres;
GRANT CREATE ON SCHEMA public TO postgres;

CREATE TABLE IF NOT EXISTS public.streamers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  platform text NOT NULL,
  channel_url text NOT NULL,
  avatar_url text,
  thumbnail_url text,
  is_live boolean NOT NULL DEFAULT false,
  viewers integer NOT NULL DEFAULT 0,
  game text,
  live_title text,
  live_video_id text,
  platform_channel_id text,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS thumbnail_url text;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS is_live boolean NOT NULL DEFAULT false;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS viewers integer NOT NULL DEFAULT 0;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS game text;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS live_title text;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS live_video_id text;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS platform_channel_id text;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS last_checked_at timestamptz;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.streamers DROP CONSTRAINT IF EXISTS streamers_platform_check;
ALTER TABLE public.streamers ADD CONSTRAINT streamers_platform_check CHECK (platform IN ('Twitch','YouTube','Kick','TikTok'));
ALTER TABLE public.streamers ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.streamers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.streamers TO authenticated;

DROP POLICY IF EXISTS "Anyone can view streamers" ON public.streamers;
CREATE POLICY "Anyone can view streamers" ON public.streamers FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Admin can add streamers" ON public.streamers;
CREATE POLICY "Admin can add streamers" ON public.streamers FOR INSERT TO authenticated WITH CHECK (auth.uid()='56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid);
DROP POLICY IF EXISTS "Admin can update streamers" ON public.streamers;
CREATE POLICY "Admin can update streamers" ON public.streamers FOR UPDATE TO authenticated USING (auth.uid()='56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid) WITH CHECK (auth.uid()='56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid);
DROP POLICY IF EXISTS "Admin can delete streamers" ON public.streamers;
CREATE POLICY "Admin can delete streamers" ON public.streamers FOR DELETE TO authenticated USING (auth.uid()='56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid);

-- + LIITU applications
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
ALTER TABLE public.streamer_applications ADD CONSTRAINT streamer_applications_platform_check CHECK (platform IN ('Twitch','YouTube','Kick','TikTok'));
ALTER TABLE public.streamer_applications DROP CONSTRAINT IF EXISTS streamer_applications_status_check;
ALTER TABLE public.streamer_applications ADD CONSTRAINT streamer_applications_status_check CHECK (status IN ('pending','approved','rejected'));
ALTER TABLE public.streamer_applications ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON public.streamer_applications TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.streamer_applications TO authenticated;
DROP POLICY IF EXISTS "Anyone can submit streamer applications" ON public.streamer_applications;
CREATE POLICY "Anyone can submit streamer applications" ON public.streamer_applications FOR INSERT TO anon, authenticated WITH CHECK (length(name) BETWEEN 2 AND 80 AND length(email) BETWEEN 5 AND 254 AND length(channel_url) BETWEEN 8 AND 500);
DROP POLICY IF EXISTS "Admin can view applications" ON public.streamer_applications;
CREATE POLICY "Admin can view applications" ON public.streamer_applications FOR SELECT TO authenticated USING (auth.uid()='56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid);
DROP POLICY IF EXISTS "Admin can update applications" ON public.streamer_applications;
CREATE POLICY "Admin can update applications" ON public.streamer_applications FOR UPDATE TO authenticated USING (auth.uid()='56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid) WITH CHECK (auth.uid()='56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid);
DROP POLICY IF EXISTS "Admin can delete applications" ON public.streamer_applications;
CREATE POLICY "Admin can delete applications" ON public.streamer_applications FOR DELETE TO authenticated USING (auth.uid()='56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid);

-- Remove old overloaded versions from previous attempts.
DROP FUNCTION IF EXISTS public.admin_add_streamer(text,text,text,text,text,text,boolean,integer);
DROP FUNCTION IF EXISTS public.admin_add_streamer(text,text,text,text,text,text,integer);
DROP FUNCTION IF EXISTS public.admin_add_streamer(text,text,text,text);

CREATE OR REPLACE FUNCTION public.admin_add_streamer(
  p_name text,
  p_platform text,
  p_channel_url text,
  p_avatar_url text DEFAULT NULL
)
RETURNS public.streamers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE r public.streamers;
BEGIN
  IF auth.uid() IS DISTINCT FROM '56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid THEN RAISE EXCEPTION 'Sul puuduvad adminiõigused'; END IF;
  IF p_platform NOT IN ('Twitch','YouTube','Kick','TikTok') THEN RAISE EXCEPTION 'Tundmatu platvorm: %',p_platform; END IF;
  INSERT INTO public.streamers(name,platform,channel_url,avatar_url) VALUES(trim(p_name),p_platform,trim(p_channel_url),NULLIF(trim(coalesce(p_avatar_url,'')),'')) RETURNING * INTO r;
  RETURN r;
END; $$;
REVOKE ALL ON FUNCTION public.admin_add_streamer(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_add_streamer(text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_application_status(p_application_id uuid,p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM '56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid THEN RAISE EXCEPTION 'Sul puuduvad adminiõigused'; END IF;
  IF p_status NOT IN ('pending','approved','rejected') THEN RAISE EXCEPTION 'Vigane staatus'; END IF;
  UPDATE public.streamer_applications SET status=p_status WHERE id=p_application_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_set_application_status(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_approve_application(p_application_id uuid)
RETURNS public.streamers LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.streamer_applications; r public.streamers;
BEGIN
  IF auth.uid() IS DISTINCT FROM '56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid THEN RAISE EXCEPTION 'Sul puuduvad adminiõigused'; END IF;
  SELECT * INTO a FROM public.streamer_applications WHERE id=p_application_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Avaldust ei leitud'; END IF;
  INSERT INTO public.streamers(name,platform,channel_url) VALUES(a.name,a.platform,a.channel_url) RETURNING * INTO r;
  UPDATE public.streamer_applications SET status='approved' WHERE id=p_application_id;
  RETURN r;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_approve_application(uuid) TO authenticated;

-- Realtime updates for the public page.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='streamers') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.streamers;
  END IF;
END $$;

-- Enable extensions needed by the scheduler.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- =========================================================
-- CRON SETUP (run AFTER deploying sync-streamers)
-- Replace YOUR_PUBLISHABLE_KEY with the Supabase publishable key.
-- This runs every 5 minutes. Twitch is checked automatically;
-- YouTube uses its Data API and therefore depends on API quota.
-- =========================================================
-- SELECT cron.unschedule('streamhub-sync');
-- SELECT cron.schedule(
--   'streamhub-sync',
--   '*/5 * * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://rrzglnazdppgjjtaswmd.supabase.co/functions/v1/sync-streamers',
--     headers := jsonb_build_object('Content-Type','application/json','apikey','YOUR_PUBLISHABLE_KEY'),
--     body := jsonb_build_object('source','cron')
--   );
--   $$
-- );
