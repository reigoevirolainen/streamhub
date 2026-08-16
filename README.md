# StreamHub PRODUCTION V2

This build has the supplied Supabase PUBLISHABLE key already in `config.js`.

## Do this once

1. Upload the files to the GitHub repo root.
2. In Supabase SQL Editor run the ENTIRE file:
   `supabase/production_v2.sql`
3. Find your own Auth user UUID in Supabase Authentication → Users.
4. Run the final admin line from the SQL file with your UUID:
   `update public.profiles set user_type='admin' where id='YOUR-UUID';`
5. Deploy/redeploy Vercel.

## Security

The browser contains ONLY the `sb_publishable_...` key. Supabase documents publishable keys as safe to expose in public browser code when RLS is configured. Secret keys (`sb_secret_...`) must stay server-side and are never included here.

## What works in this V2

- Public navigation and UI
- + LIITU → `streamer_applications`
- Admin login
- User/streamer login
- Admin-only application list
- Admin approve/reject
- Approved streamer row
- Automatic claim of approved streamer by matching email
- Streamer ONLINE/OFFLINE control
- Public LIVE/offline display
- Twitch / YouTube / Kick / TikTok
- Search and platform filters
- RLS + Data API grants

Automatic creation of a new Auth account and sending a temporary password by email is deliberately NOT faked in browser code. That requires a trusted server/Edge Function using a secret key.
