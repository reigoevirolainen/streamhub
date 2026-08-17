# StreamHub V35.5 FINAL

This build keeps the V35 design and fixes only the requested stability points:

- V35 supplied gaming/streaming hero background is included at `assets/streamhub-background.png`.
- Supplied StreamHub lightning logo is included at `assets/streamhub-logo.png`.
- The logo is used in the header and as the browser tab favicon.
- Featured Games is a real horizontal carousel with fixed card widths, arrows, native scrollbar and mouse-wheel horizontal scrolling.
- All six featured games are retained. The last card is reachable by scrolling/arrows.
- The public account-creation flow remains removed. New streamers use `LIITU STRIIMERINA`.
- The frontend calls the Edge Function **exactly** as `streamer-workflow`.
- The Edge Function is supplied at `supabase/functions/streamer-workflow/index.ts`.
- `supabase/config.toml` explicitly sets `verify_jwt = false` for this function. The function itself authenticates admin actions, so public applications can be submitted while approval/rejection stays protected.
- Run `STREAMHUB_V35_5_DATABASE_PATCH.sql` once after your existing V35/V36 database SQL. It adds the encrypted pending-password column required by the Edge Function.

## Required Edge Function secrets

Set these in Supabase Edge Function secrets:

- `STREAMHUB_PASSWORD_ENCRYPTION_KEY` — long random secret
- `RESEND_API_KEY`
- `STREAMHUB_FROM_EMAIL` — verified sender, e.g. `StreamHub <noreply@your-domain.ee>`
- `STREAMHUB_SITE_URL` — `https://streamhub.ee`

Supabase normally provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` automatically.

## Deploy

Deploy the function with the name **streamer-workflow**. Do not create or use a function named `streamer-applications`.

If using the Supabase CLI, the included `supabase/config.toml` sets the function to `verify_jwt = false`.

## Important

Do not replace the existing V35/V36 database with a shortened SQL file. The included database file is a small **patch**, not a replacement database.
