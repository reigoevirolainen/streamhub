# STREAMHUB V40

Gamingu/striimeri keskne StreamHub frontend + Supabase database repair.

## Kaust

- index.html — V40 avaleht
- style.css — V40 gaming/HUD disain
- app.js — LIVE, mängud, otsing, konto, admin, streamer workflow
- config.js — sinu Supabase URL + publishable/anon key
- STREAMHUB_V40_DATABASE.sql — idempotentne database upgrade
- assets/streamhub-mark.svg — logo mark

## Paigaldus

1. Hoia oma olemasolev Supabase projekt.
2. Ava Supabase SQL Editor.
3. Käivita `STREAMHUB_V40_DATABASE.sql` ühe korraga.
4. ÄRA kustuta olemasolevaid tabeleid ega kasutajaid.
5. Täida `config.js` oma olemasoleva Supabase Project URL-i ja publishable/anon key-ga.
6. Uploadi ülejäänud failid oma hostingusse.

## Oluline

V40 frontend kasutab järgmisi RPC funktsioone:
- submit_streamer_application
- admin_approve_application
- admin_reject_application
- admin_update_streamer
- admin_delete_streamer
- claim_my_streamer
- set_my_stream_live

Database fail loob need funktsioonid ja ei kustuta olemasolevaid streamereid, taotlusi ega Auth kasutajaid.

Admin UID jääb olemasoleva StreamHub süsteemi UID-ks:
56a4036e-b37d-4928-abf2-8f49d709f5b7

## Disaini idee

V40 säilitab algse StreamHubi struktuuri, aga teeb selle selgelt gaming/streaming suunaliseks:
- tume must/purple neon
- HUD/radar hero
- animated scanline
- background grid
- gaming glow/orbs
- Featured Games cards
- LIVE cards
- Creator Database
- Creator Hub
- Control Room admin

Ära pane `service_role` key-d frontendisse.
