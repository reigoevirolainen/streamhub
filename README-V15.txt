STREAMHUB V15 — FINAL SETUP

WHAT V15 DOES
- Beautiful responsive StreamHub UI.
- Admin adds name, platform, channel URL, and the game/category.
- Public page shows LIVE / OFFLINE.
- Twitch: automatic LIVE + viewer count + game + thumbnail.
- YouTube: automatic LIVE + concurrent viewers when API data is available.
- Kick: integration included and uses KICK_ACCESS_TOKEN.
- TikTok: kept as a platform, but its automatic LIVE status is NOT faked; TikTok's LIVE embed/API access is approval based.
- Website refreshes database data every 30 seconds.
- Supabase sync function is designed to run automatically every minute.

1) RUN SQL
Run supabase.sql once in Supabase SQL Editor as postgres.
It should return:
STREAMHUB V15 DATABASE READY

2) DEPLOY EDGE FUNCTION
Deploy:
supabase functions deploy sync-streamers

Or create the function in Supabase Dashboard -> Edge Functions and paste:
supabase/functions/sync-streamers/index.ts

3) EDGE FUNCTION SECRETS
Set:
TWITCH_CLIENT_ID
TWITCH_CLIENT_SECRET
YOUTUBE_API_KEY

For Kick, additionally:
KICK_ACCESS_TOKEN

DO NOT put these secrets in app.js or GitHub.

4) AUTOMATIC CHECK EVERY MINUTE
Supabase Dashboard -> Integrations -> Cron -> Create job.
Schedule:
* * * * *
Make an HTTP request to:
https://rrzglnazdppgjjtaswmd.supabase.co/functions/v1/sync-streamers

Header:
Content-Type: application/json
apikey: YOUR_SUPABASE_PUBLISHABLE_KEY

Alternatively use the SQL/pg_cron HTTP request shown in Supabase's current Cron documentation.

5) GITHUB / VERCEL
Upload:
index.html
app.js
style.css

Do not upload private API secrets.

6) IMPORTANT URL FORMATS
Twitch:
https://twitch.tv/username

YouTube automatic check:
https://youtube.com/channel/UCxxxxxxxxxxxxxxxx

Kick:
https://kick.com/username

TikTok:
https://www.tiktok.com/@username

7) WHY A STREAM CAN SHOW OFFLINE
If the last sync has an API error, the database keeps sync_error and last_checked_at.
For unsupported/unauthorized platforms V15 does not pretend the streamer is live.

8) LIVE PREVIEW
Twitch cards can show an iframe preview on hover when LIVE.
YouTube cards can show the live video preview when a live_video_id exists.
TikTok LIVE embedding requires TikTok approval for the host domain.

V15.1 MANUAL LIVE FALLBACK
- Admin form now has 'MÄRGI PRAEGU LIVE' for platforms where automatic LIVE detection is unavailable.
- Twitch/YouTube/Kick automatic API results remain the preferred source.
- If manual_live is enabled, the card is shown LIVE; an API sync can still update viewer count when the platform API returns a value.
- For Twitch, manual LIVE is normally unnecessary because Get Streams directly reports whether the channel is broadcasting and its viewer_count.
