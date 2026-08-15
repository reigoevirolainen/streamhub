# StreamHub V23

V23 keeps the public page and navigation working even when Supabase configuration is missing.
Backend features use the Supabase Publishable key from the Vercel environment variable:

SUPABASE_PUBLISHABLE_KEY

Do not put a `sb_secret_...` key in frontend files.

Required Vercel environment variable:
- SUPABASE_PUBLISHABLE_KEY = your `sb_publishable_...` key

After saving the variable, redeploy the project.

The existing STEP 1 and STEP 2 SQL remains the database foundation.
