# StreamHub PRODUCTION V4 FIX

This version specifically fixes the public "SAADA TAOTLUS" path.

### Why V4 is different
The previous migration attempted `ALTER COLUMN ... SET NOT NULL` on a legacy table. If old rows contained NULLs, PostgreSQL could abort the migration. V4 never performs that fragile operation.

The public browser now calls a dedicated `SECURITY DEFINER` function:
`public.submit_streamer_application(...)`

That function validates the input and inserts the application server-side. The browser only needs EXECUTE permission for the function. Direct anonymous INSERT on the application table is intentionally not required.

### Setup
1. Upload V4 to GitHub root.
2. Run the ENTIRE `supabase/production_v4_fix.sql` in Supabase SQL Editor.
3. Make sure Data API is enabled and the `public` schema is exposed. Supabase's current Data API model requires explicit grants/exposure for new public tables/functions.
4. Redeploy Vercel.
5. Test `+ LIITU`.

The supplied publishable key is already in `config.js`.
Never put an `sb_secret_...` key in frontend code.
