# StreamHub V30.2

V30.2 is based on the original working StreamHub V2 UI/database contract. The existing MAIN SQL is NOT replaced.

## Deploy
1. Upload these frontend files to Vercel/GitHub: `index.html`, `app.js`, `style.css`, `config.js`.
2. Keep the existing `supabase.sql` / MAIN database unchanged.
3. Run `v30.2_user_layer.sql` ONCE in a NEW Supabase SQL query.
4. Run it as the project SQL owner/postgres.
5. Expected result: `STREAMHUB V30.2 USER LAYER READY`.
6. Redeploy Vercel and hard refresh.

## Important
- Existing admin UID remains `56a4036e-b37d-4928-abf2-8f49d709f5b7`.
- New accounts are `role=user`; they are never created as admin.
- Existing `streamers` rows are preserved.
- Existing admin RLS policies are preserved.
- Public streamer applications remain public INSERT only.
- The user can claim an approved streamer by logging in with the same email used in the application.
- Manual ONLINE/OFFLINE and viewer controls use the existing `manual_live`/`manual_viewers` columns.

## Automatic thumbnails / LIVE
For Twitch/YouTube, the existing Edge Function can update `thumbnail_url`, `is_live` and `viewers`. Twitch's API provides `viewer_count` and `thumbnail_url`; YouTube requires the Data API and an API key. The frontend always displays the most recent stored `thumbnail_url`, so the last known thumbnail remains visible when a stream goes offline.

## API keys
Only the Supabase publishable key belongs in `config.js`. Twitch/YouTube secrets belong in the Supabase Edge Function environment, never in browser JavaScript.
