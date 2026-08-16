# StreamHub Stable FINAL

See `supabase/streamhub_stable.sql`.

1. Upload the contents of this folder to the GitHub repo root.
2. Run the SQL in Supabase SQL Editor.
3. Open the site and click ÜHENDA.
4. Paste only the Supabase Publishable key beginning with `sb_publishable_`.
5. Never put an `sb_secret_...` key in frontend files.

This stable build keeps the navigation and core UI independent of Supabase. If Supabase is unavailable, the page itself still loads and buttons still open their dialogs.
