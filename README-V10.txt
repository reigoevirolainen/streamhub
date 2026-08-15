STREAMHUB V10 FINAL

1. Upload index.html, app.js and style.css to GitHub/Vercel.
2. Run supabase.sql in Supabase SQL Editor as postgres.
3. Deploy the Edge Function:
   supabase functions deploy sync-streamers
4. Add Edge Function secrets:
   TWITCH_CLIENT_ID
   TWITCH_CLIENT_SECRET
   YOUTUBE_API_KEY
5. Test the function:
   curl -X POST "https://rrzglnazdppgjjtaswmd.supabase.co/functions/v1/sync-streamers"
6. Schedule it to run every minute using Supabase Cron/Edge Function scheduler.

IMPORTANT:
- V10 automatically verifies Twitch and YouTube.
- Kick/TikTok are retained as platforms but V10 does NOT fake their status. They show an explicit sync error until a supported API integration is added.
- For Twitch, the channel URL should be https://twitch.tv/username.
- For YouTube, use a /channel/UC... URL for automatic checking.
- Do not put Twitch client secret or YouTube API key in app.js.
- The publishable Supabase key is safe for the browser when RLS is correctly configured.

The website refreshes its data every 60 seconds.
