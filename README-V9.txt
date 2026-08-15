# StreamHub V9

## What changed
- Admin now has a **Mida ta striimib?** field.
- The game/category is saved when adding or editing a streamer.
- Twitch and YouTube sync their live status/viewers automatically when the Edge Function is deployed and API secrets are present.
- The database stores `last_checked_at` and `sync_error`, so a failed API setup is visible instead of silently looking offline.
- Kick/TikTok are NOT falsely reported as offline. They are marked with a sync warning until a supported API integration is configured.

## IMPORTANT: V8 was not enough by itself
The Edge Function is separate from Vercel. Deploy it to Supabase:

supabase functions deploy sync-streamers

and run `supabase.sql` in Supabase SQL Editor as `postgres`.

## Required Twitch secrets
TWITCH_CLIENT_ID
TWITCH_CLIENT_SECRET

## Required YouTube secret
YOUTUBE_API_KEY

Set them as Supabase Edge Function secrets. Never put client secrets in app.js or GitHub.

## Why a TikTok streamer can still show offline
TikTok is not automatically marked LIVE by this package because there is no public official endpoint here that can reliably provide arbitrary public accounts' live status/viewer count. V9 deliberately does not fake this data. A real TikTok integration needs a supported API/provider.

## Browser refresh
Vercel only hosts the frontend. Supabase Edge Functions must be deployed separately. The browser asks the sync function for a refresh and reloads the database every 60 seconds while the site is open.
