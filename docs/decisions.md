# Rozhodnutí

- 2026-09-14: Nový prázdný repozitář; původní zadání a assets se nemění. Zdrojem funkcí je zadání 1.1, vzhledu assets/visual.png.
- React Router, Tailwind přes Vite plugin, Supabase RPC pro všechny obsahové zápisy. Role v samostatné tabulce bez klientského zápisu.
- Fonty Georgia a systémový sans-serif: české znaky, bez distribuce licencovaných fontových souborů.
- App ID `cz.honzikovamoudra.app` je pracovní identifikátor, musí jej potvrdit vlastník před podpisem. Webová doména není potvrzena.
- Push: přímé APNs pro iOS; Android později. Tajné podpisy patří pouze serveru.
- Lokální prostředí Windows, Node 22.20; npm.ps1 je poškozený, používá se C:/Program Files/nodejs/npm.cmd. macOS/Xcode nejsou dostupné.
- PWA service worker cachuje jen vlastní veřejný shell. Omezená veřejná data jsou v samostatné localStorage cache s expirací 7 dní; auth, admin a instalační data se necachují.
- Widget dostává sedmidenní veřejný plán přes App Group a vlastní Capacitor plugin. Server vrací pražské denní hranice jako absolutní časy, aby timeline fungovala i v jiné zóně zařízení.
- Vlastní scheme `honzikovamoudra://` je připravený pro detail, auth, denní moudro a publikační dávku. Universal links čekají na potvrzenou HTTPS doménu.
- 2026-09-14 (Claude): Supabase projekt `xfaiukuihejtnhyslkze` je **sdílený s jinou aplikací**. Proto mají všechny objekty tohoto projektu jednotný prefix: tabulky a DB funkce `hm_`, Edge funkce a Storage bucket `hm-` (`hm-quote-media`), cron job `hm-daily-plan`. Migrace 1 už **nepoužívá plošné příkazy** typu `... on all functions/tables in schema public` ani `alter default privileges` (zasáhly by cizí projekt); granty i revoke jsou cílené výhradně na `hm_` objekty.
- 2026-09-14 (Claude): Sociální přihlášení bylo v zadání (část 2) mimo první verzi, ale vlastník ho výslovně vyžádal. Přidáno **přihlášení přes Google** (`signInWithOAuth`). Web funguje plně (PKCE + `/auth/callback`). Nativní Google (Capacitor) potřebuje ještě `@capacitor/browser` / ASWebAuthenticationSession, protože Google blokuje OAuth ve vloženém webview – zůstává jako navazující úkol.
- 2026-09-14 (Claude): Legacy sbírka (128 mouder z `HonzikovaMoudra.csv`, phpMyAdmin export, ACTIVE=1) naimportována seed migrací `202609140004_seed_quotes.sql` jako `approved` s `first_published_at` podle původního data, idempotentně přes `legacy_id`, **bez notifikací**. Obrázky (17 záznamů má v CSV název souboru) nejsou nastaveny – originální soubory zatím nedodány; mapování je v `docs/legacy-image-map.json` pro pozdější upload.
