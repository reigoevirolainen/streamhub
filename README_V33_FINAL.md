# StreamHub V33 FINAL

See pakett on mõeldud sinu praeguse StreamHub projekti jaoks.

## 1. Vercel
Asenda deploys olemasolevad failid:
- index.html
- style.css
- app.js
- config.js

## 2. Supabase
Supabase -> SQL Editor -> New query -> kleebi KOGU `v33_database.sql` -> Run.

Vana MAIN/Kasutajad/Untitled query jäävad SQL Editorisse alles. Neid ei ole vaja kustutada, kuid ära käivita neid pärast V33 migrationit uuesti.

Edukas tulemus:
`STREAMHUB V33 DATABASE READY` ja kõik viis kontrolli `true`.

## 3. Auth
Email provider peab olema lubatud. Kui Confirm email on sisse lülitatud, näitab StreamHub pärast signup'i kasutajale kinnituse teadet.

## 4. Twitch/YouTube
`supabase_edge_function_sync-streamers.ts` on kaasas. Twitch vajab Edge Function secrets: TWITCH_CLIENT_ID ja TWITCH_CLIENT_SECRET. YouTube vajab YOUTUBE_API_KEY.

V33 ei anna streamerile viewer counti muutmise õigust. Streamer saab ainult ONLINE/OFFLINE olekut muuta. Viewer count, thumbnail ja API andmed kirjutab sync/admin.

## 5. Admin
Olemasolev admin UID jääb: `56a4036e-b37d-4928-abf2-8f49d709f5b7`.

## 6. Featured Games
Fortnite, Minecraft, Call of Duty: Warzone, Apex Legends, Grand Theft Auto V ja VALORANT. Piltidel on fallback, et ühe välise CDN-i tõrge ei jätaks kaarti tühjaks.
