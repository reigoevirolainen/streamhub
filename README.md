# StreamHub Eesti — FULL v6

See versioon sisaldab:
- + LIITU vormi
- serveripoolset avalduse salvestamist + Resend e-maili
- admin login + striimerite haldus
- avalduste kinnitamine/keeldumine adminis
- Twitch / YouTube / Kick / TikTok valik
- automaatne LIVE + viewer count Twitchile
- automaatne LIVE + viewer count YouTube'ile
- automaatne LIVE + viewer count Kickile (vajab Kick Developer API credentials)
- TikTok LIVE embed valmis, kuid TikToki LIVE embed on domain-approval põhine; TikTokil ei ole avalikku üldist LIVE viewer-count API-d selle kasutusjuhtumi jaoks
- Twitch/YouTube/TikTok hover-preview, kui vastav embed töötab
- Supabase Realtime: avalik leht uuendab kaarte automaatselt pärast sync'i
- favicon

## 1. Supabase SQL
Käivita `supabase.sql` Supabase SQL Editoris `Run as: postgres`.

## 2. Deploy Edge Functions
Deploy:
- `supabase/functions/submit-streamer-application/index.ts`
- `supabase/functions/sync-streamers/index.ts`

Supabase CLI näide:

supabase functions deploy submit-streamer-application --no-verify-jwt
supabase functions deploy sync-streamers --no-verify-jwt

## 3. Secrets
Supabase Dashboard -> Edge Functions -> Secrets lisa:

RESEND_API_KEY=...
NOTIFY_EMAIL=sinu-gmail@example.com
FROM_EMAIL=StreamHub <onboarding@resend.dev>

TWITCH_CLIENT_ID=...
TWITCH_CLIENT_SECRET=...
YOUTUBE_API_KEY=...
KICK_CLIENT_ID=...
KICK_CLIENT_SECRET=...

SUPABASE_URL ja SUPABASE_SERVICE_ROLE_KEY on Supabase Edge Functionsis süsteemselt saadaval; ära pane service role key'd GitHubi.

## 4. Cron
Pärast `sync-streamers` deploy'd käivita `supabase.sql` lõpus olev cron SQL, asendades `YOUR_PUBLISHABLE_KEY` oma publishable keyga.

Cron on 5 minutit. Twitch/Kick on seega maksimaalselt umbes ühe polli võrra maas; YouTube sõltub Data API quota'st.

## 5. GitHub/Vercel
Pane repo `main` branchi ainult:
index.html
app.js
style.css
supabase.sql
supabase/config.toml
supabase/functions/...

Ära pane API secrets või `.env` faili GitHubi.

## Oluline TikToki kohta
TikTok LIVE Embed Player nõuab TikToki heakskiidetud host-domaini. Pärast StreamHubi domeeni heakskiitu saab TikToki hover-preview töötada. TikToki ametlikud avalikud API-d ei anna siin rakenduses kasutatavat üldist LIVE viewer-count/status endpointi, seega v6 ei valeta TikToki staatuse kohta ega tee seda käsitsi üle kirjutatavaks.
