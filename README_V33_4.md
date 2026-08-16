# StreamHub V33.4

Fixes based on production errors:
- Supabase PGRST202 admin_approve_application repair is in v33_4_repair.sql.
- Approval now copies streamer_applications.thumbnail_url into streamers.thumbnail_url.
- Featured game artwork is embedded directly in app.js so it does not depend on a missing assets folder.
- Login/signup frontend from V33.3 is preserved.

IMPORTANT: Run v33_4_repair.sql ONCE in Supabase SQL Editor, then run the final verification SELECT at the bottom.
