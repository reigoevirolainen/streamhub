# V36 verification checklist

Verified against the included V36 database and the V35.5 working design base.

- [x] `index.html` references `assets/streamhub-logo.png` for header and favicon.
- [x] `style.css` references `assets/streamhub-background.png` for the hero background.
- [x] `gameStrip` is horizontally scrollable and has previous/next controls.
- [x] Mouse-wheel vertical movement is converted to horizontal game-strip scrolling.
- [x] All six featured games are present in `app.js`.
- [x] Public account creation is absent; new streamer flow is `LIITU STRIIMERINA`.
- [x] `app.js` sends `action: "submit"` to `streamer-workflow`.
- [x] Admin approval sends `action: "approve"` to `streamer-workflow`.
- [x] Admin rejection sends `action: "reject"` to `streamer-workflow`.
- [x] Edge Function is named `streamer-workflow` and `verify_jwt = false`.
- [x] Edge Function uses the actual V36 database RPC `admin_approve_streamer(uuid)`.
- [x] Edge Function uses the actual V36 database RPC `admin_reject_application(uuid)`.
- [x] Pending password is encrypted in `password_ciphertext`, not stored plaintext.
- [x] Pending encrypted password is removed after approval/rejection.
- [x] Auth account is created only after admin approval.
- [x] Admin email target defaults to `reigoevert@gmail.com`.
- [x] Approval email goes to the applicant's supplied email.
- [x] Existing Supabase Auth admin account is not replaced by this build.
- [x] Full V36 database SQL is included for reference; the workflow patch is separate and idempotent.

## Local static checks performed

- JavaScript syntax check: passed with `node --check app.js`.
- Background asset: present.
- Logo asset: present.
- Database contains `admin_approve_streamer` and `admin_reject_application`.
- Frontend contains no call to `admin_approve_application`.

## What cannot be verified from a local ZIP

A real Supabase production request and Resend delivery require your deployed Supabase project and secrets. The included Edge Function has a `health` action so the deployment can be checked before submitting a real application.
