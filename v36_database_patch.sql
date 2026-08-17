-- STREAMHUB V36 DATABASE PATCH
-- Run this ONCE in Supabase SQL Editor.
-- This only adds the temporary password field needed by the approval workflow.

ALTER TABLE public.streamer_applications
ADD COLUMN IF NOT EXISTS pending_password text;

-- Make sure the existing application RPC remains executable by public visitors.
GRANT EXECUTE ON FUNCTION public.submit_streamer_application(
  text,text,text,text,text,text,text
) TO anon, authenticated;

-- Edge Function uses service_role/secret key, so it bypasses RLS.
-- Do NOT expose pending_password through public SELECT policies.
-- Keep public application SELECT disabled; only admins should read applications.

DROP POLICY IF EXISTS "Public can read pending passwords" ON public.streamer_applications;

-- Optional: ensure admins can read/update applications.
DROP POLICY IF EXISTS "Admins can read applications" ON public.streamer_applications;
CREATE POLICY "Admins can read applications"
ON public.streamer_applications
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.user_type = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can update applications" ON public.streamer_applications;
CREATE POLICY "Admins can update applications"
ON public.streamer_applications
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.user_type = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.user_type = 'admin'
  )
);

SELECT 'STREAMHUB V36 DATABASE PATCH READY' AS status;
