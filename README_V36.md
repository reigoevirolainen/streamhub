# StreamHub V36

V36 on V35 visuaalne + streamer workflow uuendus. Olemasolevaid kasutajaid, streamereid ega rakendusi ei kustutata.

## Frontend
Lae kogu paketi sisu Verceli projekti juurkausta. Supabase URL/key on `config.js`-is.

## Supabase SQL
Käivita **ainult** `v36_streamer_workflow.sql` üks kord Supabase SQL Editoris. Ära käivita vanu v33/v34/v35 repair SQL-e.

## Streamer taotlused
Avalik kasutajakonto loomise UI on eemaldatud. Liitumisvormis küsitakse striimeri nime, e-posti, platvormi, kanali, mängu, thumbnail'i ja parooli. Turvaline Edge Function loob pending Auth kasutaja ning lisab taotluse. Pending kasutaja ei pääse StreamHubi streamerina sisse enne admini kinnitamist.

## Admini ja kinnituse e-post
Paigalda Supabase Edge Function `supabase_edge_function_streamer-workflow.ts` nimega `streamer-workflow`.

Vajalikud Supabase Edge Function secrets:
- `RESEND_API_KEY`
- `STREAMHUB_ADMIN_EMAIL`
- `STREAMHUB_MAIL_FROM` (nt `StreamHub <noreply@streamhub.ee>` pärast domeeni verifitseerimist Resendis)

Supabase dokumentatsioon soovitab transactional emailide saatmiseks Edge Functionit + Resendi ning saladused tuleb hoida Edge Function secrets all, mitte browseris.

Deploy:
`supabase functions deploy streamer-workflow --no-verify-jwt`

Pärast deploy'd töötab:
- uus taotlus -> admini e-post
- admin kinnitab -> striimeri konto aktiveeritakse + kinnituse e-post
- parooli ei saadeta e-kirjas plaintextina; kiri ütleb, et kasutusel on taotluses valitud parool

## V36 disain
- Hero tekst: “Leia oma lemmik striimer ja mine talle LIVE-elamusele kaasa elama.”
- Featured Games on horisontaalne scroll koos noolte ja nähtava scrollbariga.
- Kõik striimerid on horisontaalne scroll, ilma nime/viewerite järgi sorteerimiseta.
- Tab/favikon on StreamHubi logo.
- About tekst: “StreamHub on uus platvorm, mis koondab kõik Eesti striimerid ühele lehele.”
