# StreamHub V30.2 FINAL FIX

This package keeps the existing MAIN database design and fixes the user layer instead of replacing MAIN.

## SQL order
1. Keep the existing MAIN SQL.
2. Run ONLY `v30.2_database_fix.sql` once in a new Supabase SQL query.
3. Do not run the old `Kasutajad`, old V30.2 user layer, or old FINAL DATABASE FIX afterwards.
4. The final SQL result must say `STREAMHUB V30.2 DATABASE FIX READY`.

## Auth
- Existing admin UID remains the admin authority.
- Existing Auth users are backfilled into `profiles`.
- New Auth users get a streamer profile automatically from an `auth.users` trigger.
- Username collisions are handled automatically.
- Email confirmation is supported: signup can return without a session and the UI tells the user to confirm email and log in.

## Streamer
- A streamer can submit an application.
- Admin approves it.
- The approved streamer row is claimed by matching the login email.
- Streamer can only switch ONLINE/OFFLINE.
- Streamer cannot edit viewer count.
- Viewer count remains controlled by the platform sync/admin side.

## Featured Games
Fortnite, Minecraft, Call of Duty: Warzone, Apex Legends, Grand Theft Auto V and VALORANT.

## Automatic thumbnails/viewers
The included Twitch/YouTube Edge Function updates `thumbnail_url`, `is_live`, `viewers` and game data. API secrets belong in Supabase Edge Function secrets, never in browser code.
