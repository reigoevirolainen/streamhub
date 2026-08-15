# StreamHub V27 FINAL

V27 fixes the V26 connection flow:
- Publishable key is entered in the website.
- The key is saved locally in the browser.
- Connection is NOT rejected just because a database table/RLS query fails.
- The header shows `SUPABASE ✓` when a publishable key is stored.
- Any actual database/table/RLS error is shown separately.
- Never paste an `sb_secret_...` key into the site.

Use the full Supabase Publishable key beginning with `sb_publishable_`.
