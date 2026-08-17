-- ============================================================
-- STREAMHUB V36 FINAL — WORKFLOW PATCH
-- Run ONCE in the existing StreamHub V36 database.
-- Does NOT delete users, applications or streamers.
-- ============================================================

-- The public application flow stores the chosen password encrypted while the
-- application is pending. The Edge Function deletes this value after approval
-- or rejection. It is never stored as plaintext.
ALTER TABLE public.streamer_applications
  ADD COLUMN IF NOT EXISTS password_ciphertext text;

-- The old public RPC is no longer needed by the website because applications
-- now enter through the streamer-workflow Edge Function. Keep it available for
-- compatibility with an existing database, but do not expose it publicly.
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
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated;', fn.signature);
  END LOOP;
END $$;

-- The workflow function uses this V36 admin RPC.
-- It must exist in the full V36 database:
--   public.admin_approve_streamer(uuid)
--   public.admin_reject_application(uuid)

NOTIFY pgrst, 'reload schema';

SELECT
  'STREAMHUB V36 WORKFLOW PATCH READY' AS status,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='streamer_applications'
      AND column_name='password_ciphertext'
  ) AS password_storage_ready,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='admin_approve_streamer'
  ) AS admin_approve_ready,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='admin_reject_application'
  ) AS admin_reject_ready;
