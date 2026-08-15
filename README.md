# StreamHub Full

Includes:
- Supabase streamer database + admin
- Public "Liitu" application form
- Supabase Edge Function for private email delivery
- Twitch hover preview (autoplay muted); browser policies prevent reliable automatic audio on hover, so sound is enabled by opening the stream/clicking.
- Twitch/YouTube/Kick links
- Search and platform filters

## Supabase
Run `supabase.sql` in SQL Editor as `postgres`.

Deploy `supabase/functions/submit-streamer-application/index.ts` as an Edge Function named `submit-streamer-application`.

Set these Edge Function secrets:
- `RESEND_API_KEY`
- `NOTIFY_EMAIL` = your private Gmail address

For email sending from `noreply@streamhub.ee`, verify `streamhub.ee` in Resend first.

Do NOT put secret/service keys into the website or GitHub.
