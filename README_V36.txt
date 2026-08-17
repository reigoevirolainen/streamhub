# STREAMHUB V36

## 1. Website files
Upload:
- index.html
- style.css
- app.js
- config.js
- assets/logo.svg

In `config.js`, replace:
`PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE`
with your Supabase publishable key.

## 2. Database
Run `v36_database_patch.sql` once in Supabase SQL Editor.

It adds `pending_password` to `streamer_applications`.

## 3. Edge Function
Create/open:
`streamer-workflow`

Replace its `index.ts` with:
`supabase/functions/streamer-workflow/index.ts`

Set:
`verify_jwt = false`

If using the Dashboard editor, set Verify JWT OFF in the function Settings.
This is required because the public application is not logged in.

## 4. Secrets
Set these Supabase Edge Function secrets:
- RESEND_API_KEY
- STREAMHUB_ADMIN_EMAIL = reigoevert@gmail.com
- STREAMHUB_MAIL_FROM = StreamHub <noreply@streamhub.ee>
- SUPABASE_SERVICE_ROLE_KEY = your service role key

Do not put the service role key in frontend files.

## 5. Workflow
Visitor:
Liitu striimerina -> application -> Edge Function -> database -> admin email.

Admin:
Admin -> pending applications -> AKSEPTEERI -> Edge Function -> Supabase Auth user -> profile -> streamer row -> approval email.

Streamer:
Uses the emailed email/password to log in.

## IMPORTANT SECURITY NOTE
The requested workflow sends the password by email. That is inherently less secure than a password-reset link. V36 deletes `pending_password` after approval/rejection, but while an application is pending the temporary password exists in the database. For a production-grade system, the next version should replace this with a one-time password setup link.
