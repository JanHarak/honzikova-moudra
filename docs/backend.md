# Backend a provoz

1. Vytvořit oddělený testovací Supabase projekt. Do `.env.local` vložit jen URL a veřejný anon/publishable klíč podle `.env.example`.
2. `supabase db push` aplikuje migrace. Předem povolit pg_cron. Před produkční migrací záloha a kontrola SQL; žádné produkční kroky zatím nebyly provedeny.
3. Auth: potvrzování e-mailů, SMTP a redirect allowlist na skutečnou HTTPS doménu + `/auth/callback` (včetně query pro obnovu). Mobilní universal link musí zachovat query. Zkušební účet má mít ověřený e-mail.
   - **Google provider:** v Authentication > Providers > Google zapnout a vložit Client ID + Secret z Google Cloud (OAuth 2.0 Web application, Authorized redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`). Bez toho tlačítko „Pokračovat přes Google" selže na chybě providera. Doménu webu přidat do redirect allowlistu.
4. Admina přidává pouze důvěryhodný operátor v SQL: `insert into public.hm_user_roles(user_id,role) values ('UUID_OVERENEHO_UCTU','admin');`. Nikdy role z user_metadata.
5. Nasadit Edge Functions `hm-installation`, `hm-media`, `hm-upload-image`, `hm-delete-account`, `hm-push-worker`. Instalace má vlastní náhodný credential, jeho hash v DB; anonymní tokeny nejsou klientsky čitelné. Před veřejným provozem přidat gateway rate limit pro registrace instalací a uploady.
6. Secrets: `WORKER_SECRET`, `APNS_PRIVATE_KEY`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_TOPIC`, `APNS_ENVIRONMENT=sandbox|production`. Žádný z nich nesmí mít prefix VITE_.
7. Naplánovat serverové POST na `/functions/v1/hm-push-worker` každou minutu s Authorization Bearer WORKER_SECRET. Tajný header uložit do Supabase Vault / scheduler secrets, ne do migrace. Denní plán nezávisle doplňuje pg_cron po 15 minutách (job `hm-daily-plan`); první spuštění `select public.hm_fill_daily_plan()`. **pg_cron je nutné nejdřív zapnout v dashboardu (Database > Extensions)** a poté znovu aplikovat migraci `202609140003_schedule.sql` – ta je odolná a bez zapnutého pg_cron scheduling přeskočí.
8. Webový hosting musí přepisovat všechny neexistující cesty na `/index.html`, aby přímé odkazy `/moudra/:id` a auth callback fungovaly po obnovení. Nasadit s HTTPS; doménu předem přidat do Supabase redirect allowlistu.

Obrázky se dekódují na serveru, přepočítají na WebP do 1600 px a zbaví metadat. Soukromý bucket nemá klientský zápis. Media proxy před každým stažením ověřuje aktuální approved stav a vrací no-store. Staré již stažené kopie nelze odvolat. Upload nepřidává nový publikační outbox. WASM převod vyžaduje ověření v nasazeném Edge runtime.

Outbox má claim s pětiminutovým lease, stabilní event ID, záznamy doručení a backoff. APNs collapse ID omezuje duplicity, nezaručuje přesně jedno doručení. Worker je jediný konzument; nastavit scheduler tak, aby se běhy nepřekrývaly. Selhání po deseti pokusech vyžaduje provozní dohled. APNs transport a secrets nebyly ověřeny.

Zrušení účtu: ověřený JWT → Auth Admin delete; FK SET NULL anonymizuje obsah a audit, role mizí. Funkce submit_quote ověřuje existenci Auth účtu i po jeho zrušení. Retenci provozních záznamů a dokumenty ochrany soukromí musí potvrdit vlastník.

Import: dodané schéma zatím neexistuje. `scripts/import.mjs` přijímá normalizovaný JSON, ne spouštěný SQL dump; neznámý status je pending, reportuje duplicity a chybějící soubory. Produkční zápis zatím záměrně není vystavený jako automatický příkaz: po skutečném exportu dokončit mapování, zálohu, review reportu, upload obrázků a transakční upsert podle legacy_id bez volání moderate_quotes (bez push). Historické approved záznamy musí mít first_published_at.

Rollback: před změnami záloha DB/Storage. Při chybě nejprve zastavit worker a zápisy, vrátit kompatibilní webový build, obnovit data podle zálohy. Nespouštět destruktivní reset proti produkci.
