-- ============================================================
-- STREAMHUB V35.5 — DATABASE PATCH
-- Run once in Supabase SQL Editor AFTER the existing V35/V36 DB SQL.
-- This patch does not delete users, streamers or applications.
-- ============================================================

ALTER TABLE public.streamer_applications
  ADD COLUMN IF NOT EXISTS password_ciphertext text;

-- The Edge Function is the only public submission path now.
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'submit_streamer_application'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated;', fn.signature);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

SELECT
  'STREAMHUB V35.5 DATABASE PATCH READY' AS status,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='streamer_applications'
      AND column_name='password_ciphertext'
  ) AS password_storage_ready;
