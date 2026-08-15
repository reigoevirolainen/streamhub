# StreamHub V8

## What V8 fixes
- The old RPC mismatch is removed. admin_add_streamer has exactly 5 arguments.
- The browser automatically calls sync-streamers and refreshes every 60 seconds.
- Twitch: automatic LIVE/offline, viewer count, game and thumbnail.
- YouTube: automatic LIVE/offline, viewer count, current live video and thumbnail.
- Kick/TikTok are intentionally NOT scraped or guessed. They remain in the database, but need an official/approved API integration before automatic status is enabled.
- JOIN applications are stored privately and can optionally email the admin through Resend.

## Supabase SQL
Run supabase.sql as the postgres role.
The final query must show parameter_count = 5.

## Deploy Edge Functions
From the project root, deploy:

supabase functions deploy sync-streamers
supabase functions deploy submit-streamer-application

## Required Supabase secrets for automatic Twitch/YouTube sync
Set these as Edge Function secrets (never in app.js or GitHub):

TWITCH_CLIENT_ID
TWITCH_CLIENT_SECRET
YOUTUBE_API_KEY

Optional JOIN email secrets:
RESEND_API_KEY
ADMIN_EMAIL
MAIL_FROM

The Twitch app client secret must stay private. Twitch documents app access tokens and the Get Streams endpoint; Get Streams returns only currently broadcasting streams. YouTube's search endpoint supports eventType=live and videos.liveStreamingDetails contains concurrentViewers.

## Important
The website can trigger sync publicly, but the platform secrets remain server-side in the Edge Function.
For production, schedule the sync with Supabase Cron if desired; the browser also refreshes it every 60 seconds.
