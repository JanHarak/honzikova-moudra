# iOS: konfigurace a ověření

Projekt je připraven pro Capacitor 8 a iOS 15+. Pracovní identifikátory jsou `cz.honzikovamoudra.app`, widget `cz.honzikovamoudra.app.widget` a App Group `group.cz.honzikovamoudra.app`. Před podpisem je musí vlastník potvrdit; při změně upravit Capacitor config, oba Xcode targety, entitlements, Swift bridge a APNs topic současně.

WidgetKit target podporuje `.systemSmall` a `.systemMedium`. Aplikace předává veřejný sedmidenní plán do App Group; provider vytvoří timeline z absolutních intervalů vypočtených databází pro Europe/Prague. Po vypršení plánu zobrazí poslední obsah jako potenciálně zastaralý. Klepnutí vede na `honzikovamoudra://moudra/:id`. Apple omezuje frekvenci obnov, proto přesná půlnoc ani okamžité vzdálené odvolání nejsou garantovány.

## Nutná konfigurace na macOS

1. Otevřít `ios/App/App.xcodeproj` v Xcode 26+, nastavit Development Team pro App i widget.
2. V obou App IDs povolit stejnou App Group. App targetu povolit Push Notifications; provisioning profil musí obsahovat `aps-environment`.
3. Pro potvrzenou HTTPS doménu přidat Associated Domains `applinks:DOMENA` a hostovat správný `apple-app-site-association`. Do té doby je připravený a testovatelný vlastní scheme link; universal links čekají na doménu.
4. V Supabase Auth redirect allowlist přidat `honzikovamoudra://auth/callback` a potvrzenou webovou callback URL. Ověřit registraci, ověření e-mailu a reset hesla na zařízení.
5. Nasadit serverové funkce a APNs secrets podle `docs/backend.md`; nejprve sandbox APNs.

## Matice fyzického ověření

- Čistá instalace: widget bez dat ukáže výzvu k otevření aplikace.
- Otevření aplikace: načte plán a widget dostane timeline; zkontrolovat malé i střední provedení, light/dark a zvětšené písmo.
- Změna data přes skutečnou pražskou půlnoc, letní/zimní přechod a zařízení v jiné časové zóně. Simulace data je pomocný test, ne náhrada nočního běhu.
- Offline: widget postupuje již staženou timeline; po jejím vypršení označí obsah jako zastaralý.
- Deep link z widgetu, lokální připomínky, push a auth mailu při ukončené i otevřené aplikaci.
- Denní připomínka 8:00, změna času, vypnutí a zamítnuté oprávnění. Denní a publikační kategorie nezávisle.
- APNs sandbox: jeden publikovaný záznam, hromadná dávka, retry, rotace tokenu, invalidace tokenu a kontrola, že pending/import nic neposílá.
- Odhlášení, smazání účtu, expirace relace během rozepsaného návrhu a návrat k formuláři.

Tyto kroky nejsou v aktuálním Windows prostředí proveditelné: není dostupný Xcode, Apple Developer účet, provisioning, APNs credential ani fyzický iPhone.
