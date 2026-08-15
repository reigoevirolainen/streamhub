# StreamHub V7

## The V7 fix

The V6 website called:

`admin_add_streamer(p_avatar_url, p_channel_url, p_name, p_platform)`

That was only **4 parameters**.

The database function requires **5 parameters**:

- p_avatar_url
- p_channel_url
- p_game
- p_name
- p_platform

V7 now sends:

`p_game: null`

so the RPC signature matches exactly.

## Deploy

1. Replace the files in the GitHub repository with:
   - index.html
   - app.js
   - style.css

2. In Supabase SQL Editor, run `supabase.sql` as `postgres`.

3. The final SELECT in the SQL must show:
   - parameter_count = 5
   - return_type = streamers

4. Push to GitHub. Vercel will redeploy.

5. Hard refresh StreamHub with Ctrl+Shift+R.

## Important

The public publishable Supabase key in app.js is intentionally a publishable key.
Never put a Supabase secret/service-role key in app.js or any browser file.

LIVE/viewer automation still requires the separate platform API sync/Edge Function and its API credentials.
