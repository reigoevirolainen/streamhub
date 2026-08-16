# StreamHub V5 diagnostic/fix

1. Upload this version.
2. Run the ENTIRE `supabase/production_v5_fix.sql`.
3. In Supabase Dashboard -> Integrations -> Data API, expose:
   - public.streamer_applications
   - public.streamers
   - public.profiles
   - function public.submit_streamer_application
4. Redeploy Vercel.
5. Open `/diagnose.html` and click KÄIVITA TEST.

The join form now tries the RPC first and direct INSERT second. If both fail, the exact PostgREST error code/message/hint is shown in the form.

The supplied publishable key remains in config.js. Never put an sb_secret key in the frontend.
