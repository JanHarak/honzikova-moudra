# Stav realizace

## Etapa 0 — technické ověření

Připraven Capacitor iOS projekt, malý/střední WidgetKit target, App Group bridge, deep-link router, lokální připomínka a APNs registrace. Webový build a `cap sync ios` prošly na Windows. Nativní kompilace a skutečné zařízení nejsou ověřeny: chybí macOS/Xcode 26+, Apple Developer podpis, APNs konfigurace a iPhone. Universal links čekají na potvrzenou doménu; fungování vlastního scheme je připraveno v kódu.

## Etapa 1 — webové rozhraní

Hotovo: carousel bez autoplay, swipe/tlačítka/klávesnice, stabilní detail, responzivní desktop/mobile layout, spodní navigace, světlý/tmavý/systémový režim, dlouhé texty, prázdný/chybový/offline stav a jasný ukázkový režim. Build prošel. Automatická vizuální kontrola přes prohlížeč byla zablokována stavem workspace kreditu; light/dark snímky na 320–430 px a desktopu proto zůstávají k fyzické kontrole.

## Etapa 2 — backend

Hotovo v kódu: Auth obrazovky, ověření e-mailu, reset hesla, návrhy a vlastní stavy, serverová idempotence a rate limit, transakční moderace s version checkem/auditem/outboxem, soukromý Storage upload s normalizací a zrušení účtu. RLS testy přes PGlite prošly pro anon, neověřeného, vlastníka, cizího uživatele a admina.

**2026-09-14 (Claude) – DB založena proti reálnému Supabase.** Do sdíleného projektu `xfaiukuihejtnhyslkze` aplikovány všechny 4 migrace přes `supabase db push` (prefix `hm_`/`hm-`). Ověřeno přes veřejné anon API: `hm_list_published_quotes` vrací data se stránkováním, soukromé pole `submitted_by` se nevrací, moudro dne se servíruje. Frontend načten v prohlížeči na reálných datech (128 mouder, moudro dne, není demo režim). **Přidáno přihlášení přes Google** (tlačítko na `/prihlaseni`, web ověřen vizuálně). 

Zbývá ověřit přes skutečné API: potvrzovací e-maily (SMTP), Edge Functions a Storage upload (WASM převod obrázků). **Google provider je nutné zapnout v Supabase dashboardu** (Authentication > Providers > Google) s Client ID/Secret z Google Cloud – bez toho tlačítko skončí chybou providera.

## Etapa 3 — denní obsah

Hotovo v kódu: idempotentní sedmidenní plán Europe/Prague, manuální priorita, automatický nejdéle nepoužitý výběr, revize při změně/skrytí, veřejná offline cache a dry-run importní validátor. Testy plánu prošly.

**2026-09-14 (Claude):** Skutečná data dodána a naimportována – 128 mouder z `HonzikovaMoudra.csv` seed migrací `202609140004_seed_quotes.sql` (status `approved`, idempotentně dle `legacy_id`, bez push). Denní plán jednorázově naplněn (`select public.hm_fill_daily_plan()`), 7 dní dopředu. **pg_cron zatím NENÍ zapnutý** – bez něj se plán po 7 dnech neobnoví automaticky. Nutné zapnout pg_cron v dashboardu (Database > Extensions) a znovu spustit migraci `202609140003_schedule.sql`. Obrázky mouder nedodány (17 názvů v `docs/legacy-image-map.json`).

## Etapa 4 — iOS funkce

Připraven WidgetKit timeline, fallback po expiraci, odkazy na detail, samostatné předvolby lokálních/push upozornění, stav systémového oprávnění, instalační credential a APNs outbox worker s retry/deduplikací/invalidací tokenu. Fyzické ověření je blokováno položkami z etapy 0. Serverový image WASM převod je také nutné ověřit v Edge runtime.

## Etapa 5 — předání a vydání

README, rozhodnutí, backend a iOS checklist jsou hotové. Produkční nasazení, import a TestFlight nebyly provedeny. Potřebné vstupy: export dat a médií, testovací/produkční Supabase, admin e-mail, doména/hosting, Apple Developer účet, finální bundle ID a APNs credentialy, právní a podpůrné texty.

## Poslední ověření

- `npm test`: 5 doménových/importních testů a databázový bezpečnostní průchod — prošlo.
- `npm run build`: TypeScript + Vite production build — prošlo.
- `npx cap sync ios`: web assets a 4 Capacitor pluginy — prošlo.
- `scripts/configure-ios.mjs`: dva následné běhy bez duplikace targetu — prošlo po opravě generované Xcode syntaxe.
- `npm install` audit po bezpečnostním override `uuid@11.1.1`: 0 známých zranitelností. Samostatné opakování `npm audit` později selhalo na omezeném síťovém přístupu, lockfile však obsahuje opravenou verzi.
