# StreamHub V35 FINAL — streamer-only account flow

This package keeps the **V35_FINAL visual design** and changes only the account/application workflow.

## New account flow

There is **no "Loo konto" / public signup** anymore.

Everything starts from **LIITU STRIIMERINA**:

1. Streamer enters:
   - streamer name
   - email (this becomes the login / username)
   - chosen password
   - platform
   - channel URL
   - game
   - optional thumbnail/avatar/message
2. The application is saved as `pending`.
3. The chosen password is encrypted while the application is pending.
4. `reigoevert@gmail.com` receives an email about the new application.
5. You log into the existing StreamHub **ADMIN** account.
6. Under **Taotlused**, you can **AKSEPTEERI** or **KEELDU**.
7. On approval:
   - the Supabase Auth account is created with the password the streamer chose;
   - the existing `admin_approve_application` RPC creates/links the streamer profile;
   - the encrypted pending password is deleted;
   - the streamer receives an email containing their login email and chosen password.
8. The streamer then uses **KASUTAJA → LOGI SISSE**.

## Files

- `index.html` — V35 layout, with the direct `LIITU STRIIMERINA` button.
- `style.css` — V35 design; supplied purple gaming background is used in the hero.
- `app.js` — V35 frontend logic with the new streamer-only account flow.
- `config.js` — existing Supabase URL/publishable key.
- `supabase_edge_function_sync-streamers.ts` — existing V35 live-sync function.
- `supabase_edge_function_streamer-applications.ts` — NEW application/account/email Edge Function.
- `STREAMHUB_V35_STREAMER_ACCOUNT_MIGRATION.sql` — safe database migration.
- `assets/streamhub-background.png` — supplied background artwork.

## 1. Run the SQL migration

In Supabase SQL Editor run:

`STREAMHUB_V35_STREAMER_ACCOUNT_MIGRATION.sql`

It only adds `password_ciphertext` and disables direct client execution of the old public application RPC. It does not delete users, streamers or applications.

## 2. Deploy the new Edge Function

Deploy:

`supabase_edge_function_streamer-applications.ts`

as the function:

`streamer-applications`

The existing V35 `sync-streamers` function is separate and is not replaced.

## 3. Add Edge Function secrets

Required:

- `STREAMHUB_PASSWORD_ENCRYPTION_KEY`
- `RESEND_API_KEY`
- `STREAMHUB_FROM_EMAIL`
- `STREAMHUB_SITE_URL`

Supabase normally already provides `SUPABASE_URL` and the service-role/anon keys.

### STREAMHUB_PASSWORD_ENCRYPTION_KEY

Generate a long random secret and save it as an Edge Function secret.

Example PowerShell:

`[Convert]::ToHexString((1..32 | ForEach-Object { Get-Random -Maximum 256 }))`

Do not put this key into `app.js`, `config.js`, GitHub or the ZIP deployed to the frontend.

### STREAMHUB_FROM_EMAIL

Use a sender address that your email provider has verified, for example:

`StreamHub <noreply@your-domain.ee>`

### STREAMHUB_SITE_URL

Set this to the real website address, for example:

`https://streamhub.ee`

## 4. Email provider

The Edge Function sends custom StreamHub notifications through the Resend HTTP API.

You need:
- a Resend API key;
- a verified sender/domain;
- `STREAMHUB_FROM_EMAIL` set to that sender.

The recipient for new applications is hard-coded to:

`reigoevert@gmail.com`

## Security note about the chosen password

The frontend never writes the password to the database as plaintext.

While an application is pending, the password is stored only as AES-GCM encrypted ciphertext. When you approve the application, the Edge Function decrypts it in memory, creates the Auth account, sends the approval email, and clears the encrypted value.

After approval, the password is not retrievable from the StreamHub database.

## Existing pending applications

Applications created by the old V35 flow do not contain the new encrypted password. They cannot be converted into the new approval flow with the original password because the old system never stored it.

Those applicants should submit a new application through **LIITU STRIIMERINA**.

## Frontend deployment

Upload the contents of this package to the existing Vercel project root.

Keep the existing Supabase project and existing admin account.
