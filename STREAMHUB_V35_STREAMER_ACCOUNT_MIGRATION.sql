-- ============================================================
-- STREAMHUB V35 STREAMER-ONLY ACCOUNT FLOW
-- Safe migration: adds only the encrypted pending-password column.
--
-- IMPORTANT:
-- 1) Do NOT delete auth.users, profiles, streamers or applications.
-- 2) The frontend no longer uses public signup.
-- 3) Public streamer applications are submitted through the
--    "streamer-applications" Edge Function.
-- 4) Passwords are encrypted by the Edge Function and removed
--    immediately after approval.
-- ============================================================

ALTER TABLE public.streamer_applications
  ADD COLUMN IF NOT EXISTS password_ciphertext text;

-- The old public application RPC is no longer part of the flow.
-- Leave the function in place for database compatibility, but prevent
-- clients from calling it directly.
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

-- Admin approval/rejection stays protected by the existing admin RPCs.
-- The Edge Function calls them using the real admin session, so auth.uid()
-- remains the actual admin user.

NOTIFY pgrst, 'reload schema';

SELECT
  'STREAMHUB V35 STREAMER ACCOUNT FLOW READY' AS status,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='streamer_applications'
      AND column_name='password_ciphertext'
  ) AS password_storage_ready;
