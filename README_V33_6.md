# StreamHub V33.6

## Deploy
Upload the contents of this ZIP to the Vercel project root.

## Supabase
Run **v33_6_repair.sql** once in Supabase SQL Editor. Do not run the old v33_4/v33_5 repair files.

The repair deliberately does **not** reference `manual_live` or `manual_viewers`; those columns are not required.

## Verification
The final SQL result must show all *_ready columns as `true`.

Then redeploy and hard refresh the site with Ctrl+Shift+R.
