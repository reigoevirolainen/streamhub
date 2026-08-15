# StreamHub V22 FINAL

V22 fixes the V21.1 frontend boot/navigation problem.

## What is fixed
- + LIITU opens without requiring Supabase first.
- KASUTAJA opens without requiring Supabase first.
- ADMIN opens without requiring Supabase first.
- LIVE / STRIIMERID / INFO hash navigation works independently of Supabase.
- Supabase is only required when submitting a form, logging in, loading live data, or using admin functions.
- Browser never receives a service/secret key.
- Runtime Supabase configuration can be supplied by Vercel `/api/config`.

## Vercel setup
Set this environment variable in the Vercel project:

`SUPABASE_PUBLISHABLE_KEY`

Value: your Supabase `sb_publishable_...` key.

Optional:

`SUPABASE_URL=https://rrzglnazdppgjjtaswmd.supabase.co`

Then redeploy. You do not need to edit `config.js`.

## Important
Never put `sb_secret_...` or a service-role key into `config.js` or any browser-visible file.

## Supabase SQL
The file `supabase/v22.sql` is the database migration compatible with the profiles + streamer_applications setup from Steps 1 and 2.

Run it as a new SQL query. Do not delete MAIN or the previous saved queries.

## Edge Functions
The `supabase/functions` directories from V21.1 are retained. They must be deployed to Supabase for application approval, login and status synchronization to work.

## Static UI test
Even with no Supabase key, these should work:
- + LIITU
- KASUTAJA
- ADMIN
- LIVE
- STRIIMERID
- INFO

Backend actions will show a clear configuration message until Supabase is connected.
