# StreamHub V33.2 — FINAL FIX PACKAGE

This package is a complete frontend + database repair package for the current StreamHub project.

## Included
- `index.html`
- `style.css`
- `app.js`
- `config.js`
- `assets/games/*`
- `v33_2_database.sql`
- `supabase_edge_function_sync-streamers.ts`

## 1. Supabase SQL

Run **only** `v33_2_database.sql` once in a new Supabase SQL Editor query.

Do NOT rerun the old `MAIN`, `Kasutajad`, V30.2 or V33 SQL after this.

The final result should contain:

`STREAMHUB V33.2 DATABASE READY`

and all four readiness columns should be `true`.

## 2. Supabase Auth URL Configuration

Go to Authentication → URL Configuration.

Production Site URL:

`https://streamhub.ee`

Redirect URL:

`https://streamhub.ee/**`

If you test locally, also add:

`http://localhost:3000/**`

The frontend explicitly sends `emailRedirectTo` to the current site origin when creating an account and when requesting an admin password reset.

## 3. Deploy

Upload the **contents of this folder** as the website root. Do not deploy the parent folder as an extra `v33` directory.

`index.html` must be in the deployment root.

## 4. Admin login

The admin is restricted to the existing StreamHub admin UID:

`56a4036e-b37d-4928-abf2-8f49d709f5b7`

The password is the Supabase Auth password for that account. It is not the Gmail password.

If the admin password is unknown, use the built-in `SAADA PAROOLI LÄHTESTAMISE LINK` button in the Admin login modal, or reset the password from Supabase Authentication → Users.

## 5. Important security behavior

- New Auth users become `streamer` profiles automatically.
- A normal user cannot change `user_type` to `admin`.
- A streamer can only change ONLINE/OFFLINE state.
- Viewer count is not writable by the streamer.
- Admin streamer editing/deleting uses SECURITY DEFINER RPC functions.
- Public users can submit streamer applications.
- Only admins can process applications.
- A user's own application status can be displayed without exposing other applications.

## 6. Expected flow

Register → confirm email → login → submit streamer application → admin approves → user opens account → claim streamer profile → streamer can toggle LIVE/OFFLINE.

Existing data is preserved; this SQL does not drop the profiles, streamers or streamer_applications tables.
