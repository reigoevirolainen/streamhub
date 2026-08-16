# StreamHub V30.2.1 — FUNCTIONAL FIX

This version keeps the original MAIN/admin UID model and adds the user layer without replacing MAIN.

## Supabase

1. Keep your existing `MAIN` SQL exactly as it is.
2. Existing Step 2 / applications SQL can remain in the database.
3. Run `v30.2_user_layer.sql` once in a NEW Supabase SQL query.
4. The final result must be `STREAMHUB V30.2 USER LAYER READY`.

## Auth

- User account: Supabase Auth email + password.
- Streamer application: public insert into `streamer_applications`.
- Admin: the existing ADMIN UID remains `56a4036e-b37d-4928-abf2-8f49d709f5b7`.
- A normal user cannot become admin through the browser UI.
- If email confirmation is enabled in Supabase, a new account must confirm its email before the first login.

## Admin

The ADMIN button always opens a dedicated admin login, even if another user is currently logged in.

## Streamer

After admin approval, the streamer logs into the normal user account using the same email as the application. `claim_my_streamer()` links the approved streamer record to that Auth user.

## Important

Do not replace MAIN with this migration. Do not run the old V20-V30 SQL files after this.
