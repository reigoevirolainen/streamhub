# StreamHub V33.5

See on parandatud frontend + üks puhas Supabase repair SQL.

## Deploy
1. Laadi kogu paketi sisu Verceli projekti juurkausta.
2. Supabase SQL Editor -> New query -> kleebi KOGU `v33_5_repair.sql` -> Run.
3. Tulemuses peavad kõik `*_ready` väärtused olema `true`.
4. Vercelis tee uus deployment ja brauseris Ctrl+Shift+R.

## Supabase URL
Production Site URL: `https://streamhub.ee`
Redirect URL: `https://streamhub.ee/**`

V33.5 ei sisalda Supabase secret/service-role võtit. Browseris kasutatakse ainult publishable key'd.
