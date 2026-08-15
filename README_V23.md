# StreamHub V23 FINAL

1. Put these files in the GitHub/Vercel project root.
2. Open `config.js`.
3. Paste your Supabase **Publishable key** (`sb_publishable_...`) into `SUPABASE_PUBLISHABLE_KEY`.
4. Never put an `sb_secret_...` key in the frontend.
5. `supabase/v23.sql` is a compatibility SQL for the existing `profiles`, `streamer_applications` and `streamers` tables.

V23 intentionally does not show a scary connection error on page load. If Supabase is not configured, navigation and modals still work; submitting/login will tell you that the key is missing.
