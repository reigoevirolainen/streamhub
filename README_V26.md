# StreamHub V26 FINAL

V26 removes the dependency on manually editing `config.js` for the Publishable key.

## Setup
1. Upload the project files to the repository root.
2. Open the site.
3. Click **ÜHENDA** in the header.
4. In Supabase → Settings → API Keys copy the full **Publishable key** beginning with `sb_publishable_`.
5. Paste it into the V26 connection dialog and click **ÜHENDA**.
6. The key is stored only in this browser's localStorage.
7. Never use or paste an `sb_secret_...` key into the website.

The page itself remains usable even before Supabase is connected. Submitting applications or logging in asks you to connect first.

The existing `supabase/v23.sql` remains included for the current database structure.
