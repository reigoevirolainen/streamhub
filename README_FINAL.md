# StreamHub FINAL

This is the final repair focused on the application submission path.

## Exact deployment order
1. Replace the site files with this package.
2. Supabase SQL Editor: run the ENTIRE `supabase/STREAMHUB_FINAL.sql`.
3. At the bottom of the SQL results, verify:
   - anon_schema_usage = true
   - anon_can_submit_application = true
   - anon_direct_insert = false
4. Supabase Dashboard -> Integrations -> Data API: ensure `public` is an exposed schema.
5. Redeploy Vercel with the new files.
6. Hard refresh the browser (`Ctrl+F5`).
7. Test + LIITU.

The browser calls only the `submit_streamer_application` RPC. It does not need anonymous INSERT permission on the applications table.

The supplied Publishable key is included. Secret keys must never be included in browser code.
