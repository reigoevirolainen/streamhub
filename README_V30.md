# StreamHub V30

See this as the clean production build based on the uploaded `streamhub-main.zip`.

## Install

1. Replace the files in your GitHub/Vercel project with this package.
2. Supabase -> SQL Editor -> **+ New query**.
3. Paste the ENTIRE `supabase.sql` from this package.
4. Press **Run**.
5. The final result must say `STREAMHUB V30 DATABASE READY`.
6. Redeploy Vercel and hard refresh with Ctrl+F5.

Do not run the old MAIN/Kasutajad/V15/V23/V25 SQL after this.

## What is fixed

- `+ LIITU` submits through a real `submit_streamer_application()` RPC.
- The RPC actually exists in the SQL and has EXECUTE for anon/authenticated.
- Existing `streamer_applications` is migrated instead of blindly recreated.
- Explicit Data API grants are included.
- RLS policies are recreated cleanly.
- Admin authorization uses `profiles.user_type = 'admin'`, not a hard-coded UUID.
- The existing Auth account for `reigovert@gmail.com` is set to admin by the SQL.
- Existing Auth users are backfilled into `profiles`.
- New Auth users automatically get a streamer profile.
- Admin approval creates a streamer catalog record.
- A streamer can claim an approved record by matching email.
- Streamer can set ONLINE/OFFLINE, game and viewer count.
- Public catalog shows LIVE/OFFLINE and viewers.
- Search and platform filters remain.
- No public "ÜHENDA" button.
- Browser contains only the supplied publishable key.

## Automatic platform checking

The included `supabase_edge_function_sync-streamers.ts` is for Twitch/YouTube API synchronization. It is separate from the public frontend and must be deployed as a Supabase Edge Function with the required API secrets. TikTok/Kick are not falsely reported as LIVE by that function.

## Security

Only `sb_publishable_...` belongs in `config.js`. Never put `sb_secret_...` or a service-role key into browser code. Supabase's current API model uses Postgres grants together with RLS; the SQL includes both.
