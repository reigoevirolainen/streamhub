# StreamHub V21

V21 fixes the V20 frontend dead-button problem and aligns the frontend with the STEP 1/STEP 2 database schema (`public.profiles` + `public.streamer_applications`).

## What is included
- + LIITU modal and application submission
- KASUTAJA streamer login
- ADMIN login and application approval
- Approved accounts are created as `user_type='streamer'`, never admin
- Username/password generation through Edge Function
- Streamer dashboard with ONLINE/OFFLINE
- Username/display-name/avatar editing
- Public streamer directory
- Twitch/YouTube API sync function for LIVE + viewer count
- Kick/TikTok remain manual ONLINE/OFFLINE until a suitable API integration is configured
- Hover LIVE preview for Twitch; browser autoplay policies may require a user interaction for audio
- Favicon and responsive styling

## 1. Supabase SQL
Run `supabase/v21.sql` in a NEW SQL Editor query. Do not delete your old MAIN query.

## 2. Browser config
`web/config.js` contains the Supabase project URL and a placeholder for the browser-safe Publishable/anon key.
Replace only `SUPABASE_ANON_KEY` with your Supabase browser-safe key. Never put a service/secret key in this file.

## 3. Deploy Edge Functions
Deploy these functions:
- submit-application
- approve-streamer
- streamer-login
- sync-streamer

Required secrets for the first three:
- RESEND_API_KEY
- FROM_EMAIL
- ADMIN_EMAIL

`streamer-login` also needs the normal Supabase function environment variables, including `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.

For automatic Twitch sync:
- TWITCH_CLIENT_ID
- TWITCH_CLIENT_SECRET

For automatic YouTube sync:
- YOUTUBE_API_KEY

Never expose any service/secret key in the browser.

## 4. Vercel
Upload the contents of `web/` as the static site files. Ensure `config.js` is present beside `index.html`.

## 5. Important
The + LIITU, KASUTAJA and ADMIN buttons are deliberately wired without requiring Supabase to initialize first. If `config.js` is missing or the browser key is still a placeholder, clicking a button still opens the correct UI and the app shows a clear configuration error when a database operation is attempted.
