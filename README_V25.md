# StreamHub V25 FINAL

## Setup
1. Upload the contents of this folder to the GitHub repository root.
2. Open `config.js`.
3. Put ONLY the Supabase Publishable key (`sb_publishable_...`) into `SUPABASE_PUBLISHABLE_KEY`.
4. Do NOT put `sb_secret_...` in any frontend file.
5. Deploy/redeploy Vercel.
6. Optional: open `/config-test.html` to verify the browser sees the Publishable key without revealing its value.

## Existing database
Use the SQL from `supabase/v23.sql` if your current database already has `profiles`, `streamer_applications`, and `streamers`.

## Security
The secret key supplied in chat must be considered compromised. Rotate/revoke it in Supabase and create a new secret key for server-side use only.
