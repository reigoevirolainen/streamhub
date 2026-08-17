# StreamHub V38 FINAL — V35 DESIGN PRESERVED

This package keeps the V35_FINAL visual structure and fixes the broken V37/V38 workflow.

## 1. FRONTEND DEPLOY

Upload these frontend files to the same web project:

- index.html
- style.css
- app.js
- config.js
- assets/

The page now uses local assets:

- assets/streamhub-bg.svg — background, so it cannot disappear because of an external image URL.
- assets/streamhub-logo.svg — logo, also local.

Do not remove the assets folder.

## 2. SUPABASE SQL

Run `STREAMHUB_V38_FULL.sql` once in Supabase SQL Editor.

It is based on the V37 database you supplied and adds the missing compatibility pieces used by the V35 frontend:

- owner_id / owner_email
- viewers
- user_type
- claim_my_streamer()
- set_my_stream_live()
- ensure_my_profile()
- sync_streamer_status()
- repaired admin approval linking the approved Auth user to the streamer row

Do NOT drop the existing tables or users.

At the end the SQL prints `STREAMHUB V38 READY`.

## 3. EDGE FUNCTION

Deploy `streamer-workflow.ts` as the function named:

`streamer-workflow`

In Supabase Edge Function settings, keep legacy JWT verification OFF if you are using the explicit Authorization check in this function.

## 4. IMPORTANT: EDGE SECRETS

The following MUST be three separate secrets.

Do NOT put all three lines into the value of `RESEND_API_KEY`.

Use:

RESEND_API_KEY = your Resend `re_...` API key
STREAMHUB_ADMIN_EMAIL = your admin email
STREAMHUB_MAIL_FROM = onboarding@resend.dev

Optional:

STREAMHUB_SITE_URL = https://streamhub.ee

Supabase supplies SUPABASE_URL and its server/publishable keys automatically.

If you previously pasted an actual Resend API key into chat/screenshots, revoke/rotate that key in Resend and use the new key only as an Edge Function secret.

## 5. PUBLIC APPLICATION

The V35 frontend no longer calls a missing `submit_streamer_application()` RPC.

The "LIITU STRIIMERINA" form calls:

POST /functions/v1/streamer-workflow

with:

{
  "action": "submit",
  "name": "...",
  "email": "...",
  "password": "...",
  "password2": "...",
  "platform": "TikTok",
  "channel_url": "...",
  "game": "Fortnite",
  "thumbnail_url": "...",
  "avatar_url": "...",
  "message": "..."
}

The Edge Function stores the pending application and encrypted password.

## 6. ADMIN APPROVAL

Admin panel -> Taotlused -> AKSEPTEERI

The Edge Function:

1. verifies the logged-in admin
2. creates the Supabase Auth user
3. calls `admin_approve_application`
4. links the new Auth user to the streamer
5. removes the encrypted pending password
6. sends the approval email if Resend is configured

## 7. ADMIN REJECTION

Admin panel -> Taotlused -> KEELDU

The Edge Function calls `admin_reject_application` and stores the optional reason.

## 8. STREAMER LOGIN

After approval, the streamer uses:

KASUTAJA -> LOGI SISSE

The streamer account is linked to the approved streamer profile.

## 9. LIVE / OFFLINE

The streamer account has:

LÜLITA ONLINE
LÜLITA OFFLINE

The database RPC only permits the logged-in owner to change their own streamer status.

## 10. AUTOMATIC TWITCH / YOUTUBE SYNC

Optional function: `sync-streamers`

Use `sync-streamers.ts`.

It requires:

TWITCH_CLIENT_ID
TWITCH_CLIENT_SECRET
YOUTUBE_API_KEY

Kick and TikTok are intentionally left manual instead of being falsely marked offline.

## 11. QUICK TEST

A) Open the site.
B) Refresh with Ctrl+F5.
C) Click LIITU STRIIMERINA.
D) Submit a test application.
E) Check Supabase -> Edge Functions -> streamer-workflow logs.
F) Open ADMIN -> Taotlused.
G) Approve the test application.
H) Log out / log in with the approved email and password.
I) Open KASUTAJA and test ONLINE/OFFLINE.

If the application submit returns 200 with `"ok": true`, the Edge Function/database part is working.
If `email_sent` is false, the application is still saved; fix the Resend secrets rather than submitting the application again.

## WHY V38 IS DIFFERENT

The old V35 frontend was calling RPCs that did not exist in the supplied V37 SQL, including:

- submit_streamer_application
- ensure_my_profile
- set_my_stream_live
- claim_my_streamer
- admin_delete_streamer
- admin_update_streamer

V38 removes the unnecessary application RPC and uses the existing Edge Function for the sensitive application workflow. Admin edit/delete use the existing admin RLS directly. The remaining streamer/profile RPCs are added by the V38 SQL.

The V35 visual layout is not replaced with a new minimal page.
