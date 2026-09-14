# Honzíkova moudra

React + TypeScript aplikace pro web a iOS podle [zadání 1.1](./honzikova-moudra-zadani.md). Obsah nabízí kartový carousel, detail moudra, světlý/tmavý/systémový vzhled, Supabase Auth, uživatelské návrhy bez možnosti dalších úprav, administrační workflow, moudro dne, offline veřejnou cache, lokální připomínky, APNs push a WidgetKit widget. Bez `.env.local` se spustí zřetelně označená ukázka se třemi skutečnými příklady ze zadání.

## Lokální spuštění

Požadován je Node.js 22+.

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Pro ukázkový režim nechte hodnoty Supabase prázdné. Pro integraci vyplňte pouze URL a veřejný publishable/anon klíč testovacího projektu. Service role, APNs klíče ani jiné secrets nepatří do `.env.local` nebo do proměnných `VITE_*`.

```powershell
npm test
npm run build
npm run ios:configure
npm run ios:sync
```

`ios:configure` bezpečně zopakuje tvorbu ikon, WidgetKit targetu a Xcode build settings. `ios:sync` vloží lokální webový build do aplikace. Xcode projekt je v `ios/App/App.xcodeproj`.

## Supabase

Migrace jsou v `supabase/migrations`, serverové funkce v `supabase/functions`. Postup konfigurace, admin role, Storage, APNs worker a rollback popisuje [docs/backend.md](./docs/backend.md). Přímé klientské zápisy do obsahových tabulek nemají grant ani RLS policy. Uživatel odesílá pouze přes `submit_quote`, který na serveru určí autora i stav `pending`.

Lokální plný Supabase stack vyžaduje běžící Docker Desktop:

```powershell
npx supabase start
npx supabase db reset
```

Bez Dockeru test `scripts/test-db.mjs` spouští hlavní migraci v izolovaném PostgreSQL enginu PGlite a ověřuje bezpečnostní hranice. Před produkcí jsou stále povinné API testy v samostatném Supabase projektu.

## Import

Skutečný export zatím nebyl dodán. Dry run normalizovaného JSON pole:

```powershell
npm run import:dry -- export.json cesta-k-obrazkum
```

Výsledkem je ignorovaný `import-report.json`; žádná data se nezapíší. Po dodání MySQL exportu je nutné potvrdit mapování sloupců a teprve potom doplnit transakční upsert podle `legacy_id` bez publikačních push událostí.

## Stav a iOS

Aktuální dokončení etap a blokery jsou v [docs/status.md](./docs/status.md), technická rozhodnutí v [docs/decisions.md](./docs/decisions.md) a fyzické iOS ověření v [docs/ios-verification.md](./docs/ios-verification.md). Produkční nasazení ani placená služba nebyly spuštěny.
