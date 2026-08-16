# StreamHub V33.3 FINAL

This package fixes the V33.2 frontend runtime errors:
- FormData now uses the actual submitted form (`e.currentTarget`).
- Defines the Supabase client compatibility alias used by older handlers.
- Adds missing `showError()` and `setBusy()` helpers.
- Admin edit/delete/reject use the V33.2 protected RPC functions.
- Featured game artwork uses local assets.
- app.js is cache-busted as v33.3.

Deployment:
1. Replace the site's frontend files with this package.
2. Keep config.js with the publishable key only.
3. Run v33_2_database.sql once if its V33.2 RPC functions have not already been run.
4. Supabase Auth URL Configuration: Site URL = https://streamhub.ee and Redirect URL = https://streamhub.ee/**.
