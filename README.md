# StreamHub V30 STABLE

This package is based directly on the uploaded `streamhub-main.zip`.

## Deploy
1. Replace the files in your GitHub/Vercel project with this package.
2. Supabase -> SQL Editor -> **New query**.
3. Paste the ENTIRE `supabase.sql` from this package.
4. Click **Run**.
5. The result must contain: `STREAMHUB V30 DATABASE READY`.
6. Redeploy Vercel and hard refresh with Ctrl+F5.

## Important
Do NOT run the old MAIN/Kasutajad/V15/V23/V25 SQL after this.

## Admin
The first authenticated account can bootstrap itself as admin exactly once by clicking ADMIN and logging in. After an admin exists, other users cannot bootstrap themselves.

## Security
Only the supplied `sb_publishable_...` key is in `config.js`. Supabase documents publishable keys as safe for browser apps when RLS is configured; secret keys must stay server-side.

## Automatic LIVE detection
The frontend supports the database LIVE/OFFLINE and viewer fields. Automatic Twitch/YouTube API synchronization is separate server-side work and should use a Supabase Edge Function with secrets, not browser code.
