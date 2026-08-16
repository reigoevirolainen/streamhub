# StreamHub Production V1

This is the stable production build based on the existing StreamHub concept.

## Required one-time setup
1. Put the project files in the GitHub repository root.
2. In `config.js`, paste the Supabase **Publishable key** (`sb_publishable_...`).
3. In Supabase SQL Editor, run `supabase/production_v1.sql`.
4. Set your own Auth user's `profiles.user_type` to `admin` using the commented SQL at the bottom of the script.

## Security
Do NOT put `sb_secret_...` in the browser. Supabase documents publishable keys as safe for public browser code when RLS is configured; secret keys bypass RLS and are backend-only.

## Important account-provisioning note
Approval can create the public streamer row, but automatic creation of an Auth account + sending a temporary password email requires a trusted backend/Edge Function with a secret key. It cannot safely be implemented with the browser Publishable key. The SQL therefore deliberately does not fake this step.
