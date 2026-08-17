STREAMHUB V38 FIXED

BAAS:
- Based on the working StreamHub V36 frontend, not a rebuilt/minimal page.
- Keeps Featured Games, streamer rail, admin login, account login and existing UI.
- No public "Loo konto" flow. New streamers use only "Liitu striimerina".
- Featured Games remains horizontally scrollable.
- Background image is bundled locally at assets/streamhub-bg.png.
- Logo/favicon is bundled locally at assets/logo.svg.

EDGE FUNCTION:
- Deploy supabase/functions/streamer-workflow/index.ts to function named streamer-workflow.
- It accepts apply/submit for applications and approve/reject for admin.
- It supports both STREAMHUB_MAIL_FROM and STREAMHUB_FROM_EMAIL.
- It supports STREAMHUB_ADMIN_EMAIL.
- It uses password_ciphertext (your V38 database schema must contain this column).

SECRETS:
RESEND_API_KEY=<your Resend key>
STREAMHUB_ADMIN_EMAIL=reigoevert@gmail.com
STREAMHUB_MAIL_FROM=<your verified Resend sender>

Do not put Resend API keys in config.js or frontend code.

FRONTEND CONFIG:
config.js contains the Supabase URL and publishable key. The publishable key is safe for browser use when RLS/policies are configured.
