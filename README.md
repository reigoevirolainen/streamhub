# StreamHub v4

Parandatud admini striimeri salvestamine. v4 ei kasuta HTML elementide automaatseid `window`-muutujaid, mis põhjustasid v3-s võimaliku `name`, `url`, `platform`, `live` jms konflikti.

Enne deployd käivita `supabase.sql` Supabase SQL Editoris `Run as: postgres`.

GitHubi pane failid otse `main` branchi, mitte GitHub Release'i Assets alla.


## v5
Admini uue striimeri lisamine kasutab `admin_add_streamer` SECURITY DEFINER RPC funktsiooni. Käivita kogu `supabase.sql` enne deployd.
