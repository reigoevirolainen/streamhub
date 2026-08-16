# StreamHub V35 FINAL

## Deploy
Upload the contents of this folder to the **root of the existing Vercel project**.

V35 is a frontend/design release. **No new Supabase SQL is required.** Keep the database that is already working in V33.6.

## What changed
- Full visual refresh: glassmorphism panels, cleaner spacing, stronger typography, animated hover states and responsive layout.
- Featured Games redesigned with real game artwork loaded from researched web sources instead of generated placeholder cards.
- Fortnite, Minecraft, Call of Duty: Warzone, Apex Legends, Grand Theft Auto V and VALORANT remain clickable and continue to filter streamers.
- Added live streamer and total streamer counters to the hero.
- Existing authentication, applications, admin controls and streamer status logic were left intact.
- `app.js?v=35.0` is used to prevent stale browser caching.

## Artwork sources
The game artwork URLs are intentionally kept in `app.js` so they can be updated without changing the database.

- Fortnite — Epic Games Store artwork.
- Minecraft — Minecraft key art published by Windows Central.
- Warzone — PlayStation Store artwork.
- Apex Legends — Apex promotional artwork.
- Grand Theft Auto V — official cover artwork representation.
- VALORANT — promotional Riot Games artwork.

Please keep any third-party artwork usage within the respective rights/terms. Epic explicitly points external fan sites to its Fan Content Policy, and VALORANT provides media assets for press/content creators subject to its legal guidelines.
