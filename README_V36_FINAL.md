# StreamHub V36 FINAL

This V36 keeps the working V35.5 visual design and fixes the actual workflow mismatch found in the V36 database.

## Included

- V35 gaming/streaming hero background at `assets/streamhub-background.png`
- StreamHub lightning logo at `assets/streamhub-logo.png`
- Logo in header + browser tab favicon
- Featured Games horizontal carousel with arrows, scrollbar and mouse-wheel scrolling
- All 6 featured games remain available
- `KASUTAJA` only contains login/account management; there is NO public "Loo konto" flow
- `LIITU STRIIMERINA` is the only new streamer application path
- Public application -> admin email -> admin approval/rejection -> Auth user creation -> streamer profile -> streamer email
- Password is encrypted while pending and removed after processing
- Edge Function name is exactly `streamer-workflow`
- JWT verification is OFF for this function; admin actions are authenticated inside the function

## IMPORTANT: database

Do NOT replace your working database with a shortened SQL file.

You already have the full V36 database. Run only:

`STREAMHUB_V36_DATABASE_PATCH.sql`

if `password_storage_ready` is not already true.

The Edge Function expects the full V36 database function:

`public.admin_approve_streamer(uuid)`

NOT `admin_approve_application`.

## Edge Function deploy

Deploy this exact file as:

`supabase/functions/streamer-workflow/index.ts`

The included `supabase/config.toml` contains:

`[functions.streamer-workflow]`

`verify_jwt = false`

## Secrets

Recommended:

- `RESEND_API_KEY`
- `STREAMHUB_FROM_EMAIL` = a verified Resend sender, e.g. `StreamHub <noreply@streamhub.ee>`
- `STREAMHUB_ADMIN_EMAIL` = `reigoevert@gmail.com`
- `STREAMHUB_SITE_URL` = `https://streamhub.ee`
- `STREAMHUB_PASSWORD_ENCRYPTION_KEY` = a long random secret

Supabase supplies the service key automatically in normal Edge Function deployments.
If the dedicated password-encryption secret is omitted, the function safely falls back to the Supabase service key as its encryption root, so the public application does not fail merely because this optional secret was forgotten.

## Quick health test

In Supabase Edge Function Test, send:

```json
{"action":"health"}
```

Expected response contains:

`"ok": true`

Then test the real website `LIITU STRIIMERINA` flow.

## Expected account flow

1. Visitor fills `LIITU STRIIMERINA`.
2. No email confirmation is required from the visitor.
3. Application is stored as `pending`.
4. Admin receives an email at `reigoevert@gmail.com`.
5. Admin logs in and presses `AKSEPTEERI`.
6. Supabase Auth account is created with the email + password selected by the applicant.
7. Streamer row is approved.
8. Streamer receives an email with login email + password.
9. After first login the existing `claim_my_streamer()` flow links the approved streamer profile to the Auth user.
10. Streamer can then manage their own profile/live status.

## Verification

`VERIFY_V36.md` contains the checks performed on this package. The frontend JavaScript was syntax-checked, the supplied background/logo assets are included, the carousel wiring is present, and the Edge Function's approval RPC matches the actual V36 database function name.
