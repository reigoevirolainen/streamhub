# STREAMHUB V20

See on StreamHubi uus tervikversioon, mis ühendab sinu senise V10.1 andmebaasi idee uue striimeri-konto süsteemiga.

## V20 sisaldab

- + LIITU
- kasutaja/striimeri nupp
- admini nupp
- liitumistaotlus
- taotluses:
  - nimi
  - Gmail/e-mail
  - platvorm
  - kanali URL
  - mida striimib
  - avatar
  - sõnum
- admin saab taotluse AKSEPTEERI / KEELDU
- kinnitamisel luuakse Supabase Auth konto
- konto saab `user_type=streamer`
- streamer ei saa adminiks
- genereeritakse kasutajanimi
- genereeritakse esialgne parool
- esialgne parool ei lähe PostgreSQL tabelisse
- kasutajanimi + parool saadetakse e-mailile Resendi kaudu
- striimer saab hiljem:
  - kasutajanime muuta
  - nime muuta
  - avatari muuta
  - parooli muuta
  - ONLINE / OFFLINE nuppu kasutada
- avalik leht näitab:
  - ONLINE / OFFLINE
  - vaatajate arvu
  - mängu
  - platvormi
  - thumbnail/preview
- Twitch, YouTube ja Kick saavad API kaudu live-andmeid sünkida
- TikTok kasutab V20-s streameripoolset ONLINE/OFFLINE staatust, sest TikToki avalik arendaja-API ei paku samamoodi üldist suvalise creator LIVE viewer-count endpointi.
- live kaardi hoveril on visuaalne preview

## OLULINE: SQL üksi ei saada e-maili ega loo Auth kasutajat

Supabase dokumentatsiooni järgi peab `auth.admin.createUser()` käima serveri poolel ning `service_role` võtit ei tohi browserisse panna.
V20 kasutab selleks Edge Functionit.

## 1. SQL

Ava Supabase SQL Editor ja käivita:

`supabase/v20.sql`

See on mõeldud olemasoleva StreamHub andmebaasi peale. See ei kustuta olemasolevaid streamereid.

Pärast käivitamist peab lõpus olema:

STREAMHUB V20 DATABASE READY

## 2. Edge Functions

Kaustas:

supabase/functions/

on:

- approve-streamer
- streamer-login
- submit-application
- sync-streamer

Deploy:

    supabase login
    supabase link --project-ref YOUR_PROJECT_REF
    supabase functions deploy approve-streamer
    supabase functions deploy streamer-login
    supabase functions deploy submit-application
    supabase functions deploy sync-streamer

Supabase toetab Edge Functionite deployimist CLI kaudu.

## 3. Secrets

Supabase Dashboard -> Edge Functions / Secrets:

    SUPABASE_URL=https://YOUR_PROJECT.supabase.co
    SUPABASE_ANON_KEY=YOUR_ANON_OR_PUBLISHABLE_KEY
    SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY

E-mail:

    RESEND_API_KEY=re_xxxxxxxxx
    FROM_EMAIL=StreamHub <noreply@your-domain.ee>
    ADMIN_EMAIL=sinumeil@gmail.com

Twitch:

    TWITCH_CLIENT_ID=...
    TWITCH_CLIENT_SECRET=...

YouTube:

    YOUTUBE_API_KEY=...

Kick:

    KICK_ACCESS_TOKEN=...
    SYNC_CRON_SECRET=generate-a-long-random-secret

`service_role` peab jääma ainult serveri/Edge Functioni secretiks.

## 4. Veeb

`web/config.example.js` -> tee koopia nimega:

`web/config.js`

ja pane sinna oma Supabase URL + publishable/anon key.

Näide:

    window.STREAMHUB_CONFIG = {
      SUPABASE_URL: "https://xxxxx.supabase.co",
      SUPABASE_ANON_KEY: "sb_publishable_xxxxx"
    };

Ära pane service_role võtit siia.

## 5. Cron – automaatne viewer count

`sync-streamer` kontrollib kõik streamers tabelis olevad striimerid.

Seda tuleb käivitada perioodiliselt.

Soovitus:

- iga 1–2 minuti tagant
- või iga 30 sekundi tagant, kui striimereid on vähe

Supabase Cron saab kutsuda Edge Functionit perioodiliselt.

Dashboard:
Integrations -> Cron -> Create job

Function:
`sync-streamer`

Header:
`x-sync-secret: YOUR_SYNC_CRON_SECRET`

Body:
`{}`

## 6. Platvormide tegelik käitumine

### Twitch

Twitch Helix `Get Streams` annab:
- live/offline
- viewer count
- game
- thumbnail
- stream id

### YouTube

YouTube Data API annab live broadcasti `concurrentViewers` väärtuse siis, kui broadcast on live ja viewcount pole peidetud.

### Kick

KICK Dev API pakub aktiivsete livestreamide infot ja viewer count'i. Selle jaoks peab olema KICK API access token.

### TikTok

V20 ei hakka TikToki jaoks mingit suvalist scrape'i kasutama. TikToki ametlik arendaja API ei anna sama lihtsat üldist current-LIVE-viewer-count API-t suvalise creator'i jaoks. Seetõttu:
- streamer vajutab ONLINE
- streamer vajutab OFFLINE
- viewer count jääb API-integratsiooni puudumisel viimaseks teadaolevaks väärtuseks

## 7. Väga oluline ONLINE loogika

Streamer saab vajutada:

ONLINE

või

OFFLINE

See ei anna streamerile õigust viewer count'i muuta.

Viewer count tuleb API adapterist.

Seega:
- ONLINE/OFFLINE = streamer presence
- viewers = platvormi API
- game = platvormi API, kui saadaval
- thumbnail = platvormi API, kui saadaval

## 8. Turvalisus

Tavaline streamer:
- ei saa streamer_applications tabelit lugeda
- ei saa teisi kasutajaid muuta
- ei saa streamers tabelisse uusi ridu lisada
- ei saa viewer count'i ise muuta
- ei saa is_admin väärtust muuta
- ei saa user_type väärtust muuta
- saab muuta ainult oma profiili
- saab muuta ainult oma ONLINE/OFFLINE staatust

Admin:
- saab taotlusi vaadata
- saab taotlusi kinnitada/tagasi lükata
- saab hallata streamereid

Avalik külastaja:
- saab streamereid vaadata
- saab taotluse saata

## 9. Praeguse StreamHubi disaini säilitamine

`web/` sisaldab V20 töötavat baasfrontend'i.

Kui sul on juba oma ilus StreamHub frontend olemas, siis ära seda automaatselt üle kirjuta. V20 SQL + Edge Functions saab ühendada sinu olemasoleva UI-ga.

