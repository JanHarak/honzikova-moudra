# Honzíkova moudra — kompletní zadání pro vývoj

Verze 1.1 • 13. září 2026 • Jazyk produktu: čeština

Změna ve verzi 1.1: zapracován zadavatelem schválený náhled webu a mobilní aplikace s modrou sovou, kartovým carouselem a světlým/tmavým režimem. Funkční rozsah zůstává zachován. Vizuální specifikace je v části 5.7, doplněna jsou také akceptační kritéria a instrukce pro implementaci.

Tento dokument je podklad pro společný vývoj s Codexem a Claudem. Popisuje cílový produkt, nikoli již vytvořenou aplikaci. Dosavadní web se nebude analyzovat ani předělávat: vznikne nový projekt. Ze stávajícího řešení se převezmou pouze dodaná data a obrázky.

## 1. Cíl produktu

Vytvořit jednoduchý, vizuálně osobitý web a mobilní aplikaci pro prohlížení krátkých humorných hlášek „Honzíkova moudra“. Hlavní zážitek tvoří kartový carousel a společné moudro dne. Registrovaní uživatelé mohou navrhovat nová moudra; veřejné zobrazení vždy podléhá schválení administrátora. Na iPhonu bude k dispozici widget s denním moudrem a aplikace nabídne dobrovolná upozornění.

Skutečné příklady obsahu dodané zadavatelem:

- „Víc je víc než míň.“
- „Smrt je vysvobození.“
- „Nikdy nikomu never.“

Zachovat slovní hříčky a záměrně nestandardní jazyk. Neopravovat automaticky smysl ani neoznačovat vymyšlené demonstrační hlášky za skutečný obsah sbírky.

## 2. Závazný rozsah a výchozí rozhodnutí

### Potvrzené požadavky

- Nový web od nuly; stávající web je HTML/CSS/PHP.
- Sdílený základ v Reactu, TypeScriptu a Tailwind CSS, Vite a Capacitor.
- Supabase jako navržený a přijatý backend.
- Mobilní aplikace instalovatelná na iPhone; PWA může doplnit web, ale nenahrazuje nativní widget.
- Kartový carousel, textová moudra a moudra s obrázkem.
- Přidávání pouze pro registrované uživatele. Po odeslání uživatel moudro neupravuje ani nemaže.
- Administrace: úpravy, schvalování, zamítání, skrytí a plánování.
- Widget s moudrem měněným jednou denně.
- Samostatně nastavitelná upozornění na moudro dne a na nově publikovaná moudra.
- Světlý, tmavý a systémový režim vzhledu.
- Vizuální směr podle odsouhlaseného náhledu: modrá sova v záhlaví, výrazná typografie mouder, bílé nebo tmavé karty a kobaltově modré ovládací prvky; podrobně část 5.7.
- Převzetí přibližně 100 mouder z MySQL spravované přes phpMyAdmin a existujících obrázků.

### Doporučené výchozí volby pro implementaci

Následující volby konkretizují zadání. Lze je použít bez dalšího návrhového kola; odchylky zaznamenat do rozhodovacího deníku.

| Oblast | Výchozí volba |
| --- | --- |
| Platformy | Web a iOS v první verzi; Android připravit architekturou, jeho vydání a widget potvrdit před samostatnou etapou |
| Moudro dne | Jedno společné pro všechny, datum podle Europe/Prague |
| Denní upozornění | Výchozí nabízený čas 8:00 v místním čase zařízení; uživatel může změnit |
| Registrace | E-mail a heslo, ověření e-mailu a obnova hesla |
| Obrázky | V první verzi nahrává a spravuje administrátor; uživatel odesílá text |
| Text | 1–500 znaků po odstranění krajních mezer, prostý text, bez HTML |
| Obrázek | Nejvýše jeden na moudro, JPEG/PNG/WebP, vstup do 10 MB; optimalizace a limit rozměrů na serveru |
| Carousel | Moudro dne první, další schválená moudra v předvídatelném pořadí; explicitní tlačítko náhodného výběru není nutné |
| Návrhy uživatele | Soukromý přehled vlastních návrhů a jejich stavů; žádné úpravy |
| Upozornění na novinky | Jedna zpráva pro jednu publikační dávku; dávka vznikne jedním potvrzením administrátora |
| Provozní základ | Oddělené vývojové/testovací a produkční prostředí |

Oblíbené, veřejné profily, komentáře, hodnocení, žebříčky, sociální přihlášení, placené funkce, automaticky generovaná moudra a uživatelské nahrávání obrázků nejsou součástí první verze. Prostý odkaz na detail moudra bude sdílitelný; export obrázkových kartiček je budoucí rozšíření.

## 3. Technologie a architektura

| Vrstva | Technologie a odpovědnost |
| --- | --- |
| Aplikace | React + TypeScript, striktní typování |
| Stylování | Tailwind CSS, společné barevné a typografické tokeny |
| Sestavení | Vite |
| Navigace | React Router nebo rovnocenné jednoduché řešení; zapsat volbu |
| Mobilní obal | Capacitor, iOS projekt uložený v repozitáři |
| Data | Supabase PostgreSQL, verzované SQL migrace a generované TypeScript typy |
| Identita | Supabase Auth |
| Média | Supabase Storage |
| Oprávnění | PostgreSQL RLS, kontrolované databázové funkce a serverové operace |
| Úlohy na pozadí | Serverové funkce a plánovač pro denní plán a odesílání zpráv |
| iOS widget | SwiftUI + WidgetKit, sdílení vybraných dat přes App Groups |
| Upozornění | Capacitor Local Notifications a Push Notifications; serverová integrace APNs nebo FCM→APNs podle úvodního ověření |

Ionic UI není nutné. Nevytvářet souběžně druhé rozhraní v React Native. Web a hlavní mobilní aplikace sdílejí komponenty, validace a datové kontrakty. Widget je samostatná nativní implementace se stejným datovým kontraktem; React ani Tailwind jej nevykreslují. Capacitor podporuje připojení k existujícímu webovému projektu. [Dokumentace Capacitoru](https://capacitorjs.com/docs)

Tailwind integrovat přes oficiální Vite plugin. Konkrétní stabilní verze závislostí ověřit při zahájení implementace a uložit lockfile. [Tailwind s Vite](https://tailwindcss.com/docs/installation/using-vite)

Hostování webu zvolit při implementaci podle dostupného prostředí. Musí podporovat HTTPS, routování SPA na přímé odkazy a bezpečnou konfiguraci. Hosting není důvod měnit dohodnutý backend. Serverové klíče nikdy nevkládat do klienta ani mezi proměnné `VITE_*`. Mobilní aplikace má obsahovat vlastní sestavené webové prostředky; nespoléhat na pouhé otevření vzdálené URL.

## 4. Uživatelé a oprávnění

| Operace | Nepřihlášený | Registrovaný s ověřeným e-mailem | Administrátor |
| --- | --- | --- | --- |
| Číst schválená moudra a moudro dne | Ano | Ano | Ano |
| Poslat nový text | Ne | Ano, vždy jako pending | Ano |
| Číst vlastní návrhy a jejich stav | Ne | Ano | Ano |
| Číst cizí neschválené návrhy | Ne | Ne | Ano |
| Změnit nebo smazat odeslané moudro | Ne | Ne | Ano, v rámci správy |
| Schválit, zamítnout, skrýt, plánovat | Ne | Ne | Ano |
| Nahrát nebo vyměnit obrázek | Ne | Ne | Ano |
| Měnit vlastní vzhled a upozornění | Ano na zařízení | Ano na zařízení | Ano na zařízení |

Role administrátora se nastavuje důvěryhodným postupem mimo běžnou registraci. Uživatel ji nesmí získat úpravou profilu, metadat nebo přímým API požadavkem. Veřejné odpovědi neobsahují e-mail autora, interní poznámky ani identifikátory push zařízení.

Oprávnění musí vynucovat databáze/server. Skrytí tlačítka nebo chráněná frontendová route není bezpečnostní opatření. Použít RLS pro všechny klientsky dostupné tabulky. [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)

## 5. Obrazovky a chování

### 5.1 Hlavní obrazovka

- Záhlaví s názvem Honzíkova moudra, volbou vzhledu a účtem.
- Ihned viditelný carousel; žádná marketingová úvodní stránka před obsahem.
- První karta označená „Moudro dne“.
- Velký, dobře čitelný text a případný obrázek; karta bez obrázku působí dokončeně.
- Posun gestem, tlačítky a klávesnicí. Čtení nevyžaduje swipe.
- Žádné automatické přepínání. Posun nesmí narušit svislé scrollování.
- Dlouhé texty se nezkracují tak, aby zmizela pointa; podle potřeby posuv nebo detail.
- Obrázky se nedeformují; celý obsah je dostupný v detailu.
- Viditelná možnost přidat moudro, která nepřihlášeného přivede k přihlášení a po něm vrátí k formuláři.

### 5.2 Detail moudra

Stabilní URL, například `/moudra/:id`. Zobrazí celé schválené moudro a obrázek. Otevření stejného odkazu má fungovat přímo i po obnovení stránky. Skrytý, zamítnutý či neexistující záznam zobrazí obecné „Moudro není dostupné“, bez prozrazení jeho textu. Pro aplikaci nastavit deep links; ověřit příchod z ukončeného stavu i již otevřené aplikace.

### 5.3 Přihlášení a účet

Registrace, ověření e-mailu, přihlášení, odhlášení a reset hesla. Dokončení autentizačních odkazů musí fungovat na webu i v Capacitoru. Po odhlášení odstranit soukromou cache. Zohlednit expiraci relace při odesílání formuláře a zachovat rozepsaný text na aktuální obrazovce. Soukromý přehled návrhů obsahuje text, datum a stav.

Pro vydání aplikace s účty připravit proces zrušení účtu, odvolání přístupu a anonymizace vazeb. To není uživatelská editace publikovaných mouder. Konkrétní retenční pravidla a povinnosti obchodů ověřit před vydáním s vlastníkem produktu.

### 5.4 Přidání moudra

Prostý text, počítadlo znaků, srozumitelná validace, tlačítko Odeslat. Po úspěchu „Moudro čeká na schválení“. Odeslání nesmí vyvolat veřejnou notifikaci. Zakázat dvojité odeslání a opakování stejného požadavku řešit idempotentně. Duplicitu textu označit pro administrátora. Výchozí serverový limit 5 návrhů za hodinu na účet, konfigurovatelný; IP limit jako doplněk, ne jediná identita.

### 5.5 Nastavení

Volby Světlý / Tmavý / Podle systému; výchozí systém. Preference se uchová na zařízení přes restart. Systémová varianta reaguje na změnu systému a první vykreslení pokud možno neblikne opačnou barvou.

Samostatné přepínače Moudro dne a Nová moudra; denní čas, skutečný stav systémového oprávnění a možnost změnu oprávnění vysvětlit. Odmítnutí notifikací neblokuje prohlížení. Nastavení upozornění je v první verzi po jednotlivých instalacích, nikoli automaticky synchronizované mezi zařízeními. Odběr nevyžaduje účet; registrace je nutná pouze pro posílání mouder.

### 5.6 Administrace

Oddělená chráněná část se seznamy Čekající / Schválená / Zamítnutá / Skrytá a denním plánem. Administrátor může zobrazit návrh, opravit text, přidat obrázek a jeho alternativní popis, schválit nebo zamítnout, případně skrýt dříve publikovaný obsah. Interní poznámky se nesmějí objevit ve veřejném API.

Podporovat schválení více vybraných návrhů jedním potvrzením. Změna stavu, audit a vytvoření publikační události musí být transakčně konzistentní. Výchozí mazání obsahu řešit skrytím; trvalé odstranění vyžaduje explicitní potvrzení a ošetření vazeb. Historie zaznamená administrátora, čas a změnu.

### 5.7 Schválený vizuální směr — web a mobilní aplikace

Zadavatel schválil vzhled posledního náhledu jako směr pro skutečné rozhraní. Zachovat jeho kompozici, charakter a vizuální hierarchii; nejde o požadavek přesně kopírovat každý pixel, reklamní text nebo chybu generovaného obrázku. Náhled je vizuální reference, nikoli implementovaná aplikace. Pokud se dekorace v náhledu rozchází s funkcemi tohoto dokumentu, platí funkční zadání.

**Referenční podklady z této konverzace:**

- [Schválený náhled webu a mobilní aplikace](sandbox:/workspace/scratch/5f0f1cc83b39/generated_images/exec-480712ad-0a1b-4536-9cbd-e983a606122f.png)
- [Samostatná modrá sova bez nápisu](sandbox:/workspace/scratch/5f0f1cc83b39/generated_images/exec-1af7c41e-14cb-46d8-8439-c90596e44aa0.png)

Tyto odkazy odkazují na podklady této konverzace. Při předání do jiného prostředí přiložit také oba obrázky; nespoléhat na dostupnost původních cest. V repozitáři je uložit například do `docs/design/` a odkazy upravit na relativní. Následující textová specifikace umožňuje pracovat i bez původního prostředí.

#### Značka a sova

V tomto schváleném návrhu rozhraní používat modrou sovu jako hlavní symbol vedle textu „Honzíkova moudra“. Má výrazné asymetrické oči: jedno otevřené, druhé přimhouřené, světle modrý zobák, bílé oči a břicho, tmavé zorničky a jednoduchou modrou siluetu. Zachovat její pobavený, lehce skeptický výraz. Sova musí být dostupná také samostatně bez nápisu.

Dřívější modré HM je alternativní logo, nikoli povinný další prvek těchto obrazovek. Nemíchat HM a sovu nahodile mezi jednotlivými stránkami. Aktuální výchozí volba pro web, aplikaci a widget je sova; případný přechod na HM musí být vědomé sjednocené rozhodnutí.

Z dodané rastrové reference připravit čistý produkční asset, ideálně SVG a potřebné PNG exporty. SVG musí obsahovat skutečné vektorové tvary, nikoli pouze vložený bitmapový obrázek. Při převodu zachovat charakter a ověřit vzhled ve velikostech 24, 32 a 48 px. Bílá uvnitř očí a břicha zůstává neprůhledná i na tmavém pozadí. Vně symbolu může být průhlednost. Pro ikonu iOS připravit zvláštní plné pozadí a export podle aktuálních požadavků platformy.

#### Barvy, písmo a povrchy

Níže uvedené hodnoty jsou doporučené výchozí designové tokeny odvozené z náhledu, nikoli přesně změřené barvy obrázku. Drobné změny pro čitelnost jsou přípustné.

| Token / prvek | Světlý režim | Tmavý režim |
| --- | --- | --- |
| Primární barva, hlavní tlačítko | Kobaltová `#064BFF`, bílý text | Kobaltová `#064BFF`, bílý text |
| Pozadí aplikace | Chladná téměř bílá `#F5F7FB` | Tmavá `#111820` |
| Povrch karty | Bílá `#FFFFFF` | Tmavě šedomodrá `#202B36` |
| Hlavní text | Téměř černá `#141820` | Téměř bílá `#F7F9FC` |
| Vedlejší text | Šedomodrá `#526174` | Světlá šedá `#B5C0CD` |
| Jemný okraj | `#DFE5EE` | `#405063` |
| Odkaz a malý aktivní text | Tmavší modrá s ověřeným kontrastem | Světlejší modrá, například `#70A5FF` |

Všechny skutečné kombinace ověřit na kontrast; nepoužívat automaticky stejnou modrou pro malé písmo na obou pozadích. Tmavý režim navrhnout samostatnými tokeny, nikoli prostou inverzí.

Moudra a hlavní titulky mají výrazné patkové písmo podobně jako v náhledu; ovládání, pomocné texty a formuláře používají čitelný bezpatkový font. Vybrat dostupné fonty s českou diakritikou a vhodnou licencí a zaznamenat je do dokumentace. Nepřebírat nahodilé rozdíly písma mezi generovanými obrazovkami. Velikost moudra se přizpůsobí délce: krátká hláška může být výrazně větší, dlouhá musí zůstat celá dostupná a čitelná. Orientačně 40–64 px pro krátkou hlášku na desktopu a 28–40 px na mobilu; běžný text alespoň 16 px.

Karty mají zaoblení přibližně 20–24 px, hlavní tlačítka 10–12 px. Světlé karty mají měkký decentní stín, tmavé spíše jemný okraj. Rozestupy vycházejí z pravidelné škály 4/8 px. Bez těžkých efektů, nepřetržitého pohybu a dekorativního 3D.

#### Desktopový web

- Kompaktní vodorovné záhlaví: vlevo malá sova a čitelný název, vpravo volba vzhledu, účet a primární „Přidat moudro“. Po přihlášení nahradit „Přihlásit se“ odpovídajícím účtem.
- Pod záhlavím centrovaný titul „Dnešní dávka moudrosti“. Pomocný slogan není povinný; hlavní obsah nesmí odsouvat pod první obrazovku.
- Střed tvoří dominantní karta moudra dne, po stranách náhled předchozí a další karty. Středová karta je větší a vizuálně nejsilnější.
- Uvnitř hlavní karty je malý štítek „MOUDRO DNE“, výrazná hláška a malá sova jako podpis. Sova nenahrazuje případný obrázek přiřazený k moudru.
- Kulatá tlačítka předchozí/další na okrajích carouselu; pod ním indikátor pozice. U přibližně 100 záznamů nepoužívat 100 teček: zobrazit omezené okno indikátorů nebo čítač aktuální pozice.
- Výrazná možnost „Navrhnout vlastní moudro“ a krátké vysvětlení „Nová moudra nejprve schválíme.“ mohou být pod carouselem. V záhlaví zůstává rychlý vstup do stejného formuláře.
- Šířku obsahu omezit přibližně na 1200 px; carousel přizpůsobit viewportu, ne pevné šířce obrázku.

#### Mobilní aplikace a úzký web

- Stejná vizuální identita; kompaktní hlavička se sovou, názvem a dostupnou volbou vzhledu/účtu.
- Jedna hlavní karta přes většinu šířky s malým náznakem sousední karty. Dlouhý obsah nesmí kolidovat s ovládáním ani být skrytý spodní navigací.
- Zachovat ruční posun gestem i alternativní tlačítka. Dots nejsou jediným způsobem ovládání.
- Spodní navigace se třemi položkami „Moudra“, „Přidat“, „Nastavení“, každá s ikonou a textem. „Přidat“ otevírá formulář nebo přihlášení s návratem do formuláře.
- Aktivní položka je modrá a rozlišitelná i jinak než barvou. Navigace respektuje spodní safe area telefonu a obsah má odpovídající spodní odsazení.
- Při otevřené klávesnici zachovat použitelný formulář a dostupné odeslání. Mobilní šířky 320–430 px nesmějí vést k horizontálnímu přetékání.
- Přepínač vzhledu v hlavičce může nabídnout malé menu; nastavení vždy poskytuje všechny tři volby Světlý / Tmavý / Podle systému, i když náhled zjednodušuje ovladač na slunce/měsíc.

#### Obrázky, další obrazovky a obsah náhledu

Obrázková karta může používat přiřazený obrázek jako část plochy nebo pozadí, ale text musí zůstat skutečným HTML textem, čitelný s případným podkladem. Důležitý obsah obrázku se nesmí nevratně oříznout; detail nabízí celé médium a alternativní popis. Obrázek oblohy a dodatečné moudro z návrhu jsou pouze ilustrace, nikoli automaticky schválená součást sbírky.

Přihlášení, přidání, nastavení, vlastní návrhy i administrace používají stejné barvy, rádiusy a ovládací prvky. Administrace může být přehlednější tabulková pracovní plocha, nemusí napodobovat carousel. Widget má stejnou sovu a barvy, ale vlastní nativní layout přizpůsobený jeho velikosti.

Nekopírovat do aplikace okolní prezentaci obrázku: rámečky zařízení, falešnou adresu prohlížeče, ručně psané slogany, marketingové ikony ani reklamní patičku. Doména z obrázku není potvrzená doména projektu. Nezavádět srdíčka/oblíbené nebo jiné funkce jen proto, že se jejich symbol v prezentační grafice objevil.

## 6. Stavy a publikace

Stavy: `pending`, `approved`, `rejected`, `hidden`.

- Uživatel vytváří pouze `pending` s vlastní identitou autora.
- Administrátor převádí `pending` na `approved` nebo `rejected`.
- Administrátor může schválené moudro skrýt; obnovení provádí opět explicitně.
- Veřejně se čte pouze `approved`. Naplánování není další stav a nesmí obejít schválení.
- Publikační notifikace vzniká při prvním zveřejnění, nikoli při editaci, opakovaném uložení nebo obnovení skrytého záznamu.
- Pole `first_published_at` a trvalý identifikátor publikační události brání opakovanému rozesílání.
- Při souběžné práci administrátorů detekovat zastaralou verzi záznamu místo tichého přepsání.

## 7. Moudro dne

Jedno společné denní moudro podle data v časové zóně Europe/Prague. Denní připomínka se naproti tomu řídí místním časem zařízení. Tento rozdíl musí být popsán v kódu i nastavení.

Pro každý den uložit konkrétní vazbu datum → moudro. Nelosovat znovu při každém načtení. Administrátorský výběr má přednost. Automatika doplňuje chybějící dny ze schválených mouder, preferuje nejdéle nepoužitá a neopakuje žádné, dokud neprojde dostupnou sbírku, pokud to velikost sbírky dovolí. Při jednom moudru je opakování správné; při nulovém počtu zobrazit prázdný stav.

Plánovač připravuje alespoň 7 dní dopředu a je idempotentní. Veřejné API pro widget může vracet tento omezený horizont, výhradně již schválená moudra. Skrytí naplánovaného moudra musí opravit dotčený plán a zvýšit revizi. Již stažený obsah v offline zařízení nelze okamžitě odvolat; po dalším spojení se cache aktualizuje.

## 8. Widget pro iPhone

- Součást iOS aplikace jako WidgetKit extension; nelze dodat samotnou PWA.
- První verze podporuje malou a střední velikost na ploše. Lock Screen widget je další rozšíření.
- Zobrazuje moudro dne a identitu aplikace. V malé velikosti upřednostnit text; delší text lze zkrátit a klepnutím otevřít celý.
- Respektuje systémový vzhled, případně sdílenou ruční volbu aplikace.
- Klepnutí otevře odpovídající moudro v aplikaci.
- Předem načte omezený denní plán a připraví timeline; denní změna nesmí záviset na každodenním otevření aplikace.
- Widget musí mít vlastní cestu obnovy dat, cache a fallback pro výpadek sítě. App Group nesmí obsahovat administrátorské klíče ani citlivá data.
- První spuštění bez dostupných dat má srozumitelný prázdný stav. Po vypršení plánu nesmí staré moudro vydávat za aktuální: zobrazí poslední obsah s informací o stáří nebo výzvu k aktualizaci.

iOS řídí časování a rozpočet obnov widgetu. Změnu přesně o půlnoci ani okamžité vzdálené odvolání obsahu nelze garantovat. Timeline se připraví podle denních hranic převedených z Europe/Prague na absolutní čas. Ověřit změnu letního času i zařízení v jiné zóně. [Apple: aktualizace widgetu](https://developer.apple.com/documentation/widgetkit/keeping-a-widget-up-to-date)

## 9. Upozornění

### 9.1 Denní připomínka

Nezávislá na tom, zda má uživatel přidaný widget. Výchozí realizace: místní opakovaná notifikace přes Capacitor s obecným textem „Dnešní moudro na tebe čeká“. Po otevření vyřeší aktuální moudro dne. Tím se do upozornění nezamkne zastaralý text při změně plánu. Přímé vložení citátu je pozdější volba vyžadující aktualizaci naplánovaných notifikací.

Povolení žádat po vysvětlení a akci uživatele, ne automaticky při prvním otevření. Změna času ruší původní plán a vytvoří nový, vypnutí ho zruší. Ošetřit časovou zónu a letní čas; doručení může ovlivnit nastavení systému a režim Soustředění. [Capacitor Local Notifications](https://capacitorjs.com/docs/apis/local-notifications)

### 9.2 Nově publikovaná moudra

Skutečná serverová push zpráva, nikoli JavaScript timer nebo zpráva zobrazovaná jen v otevřené stránce. Administrátorská publikační transakce vytvoří událost v outboxu. Worker ji převezme a odešle pouze instalacím s platným oprávněním a zapnutým odběrem. Jedno moudro otevře detail; dávka otevře přehled jejích stále schválených mouder.

Při hromadném schválení poslat jednu souhrnnou zprávu. Při retry udržet stabilní ID události a deduplikovat, kde to poskytovatel a klient dovolují; neslibovat přesně jedno doručení na systémové úrovni. Neplatné tokeny odstranit, dočasné chyby opakovat s backoffem. Před odesláním znovu ověřit, že obsah není skrytý. Historický import neposílá žádné notifikace.

Mobilní registrace tokenu a změny odběru musí být chráněné. Pro nepřihlášené instalace použít serverem vydaný instalační credential, který opravňuje pouze ke správě vlastního endpointu; neposkytovat veřejný seznam tokenů. Po rotaci tokenu starý nahradit. Serverové credentialy APNs/FCM jsou jen v secrets. Volba FCM neznamená přesun databáze do Firebase. [Capacitor Push Notifications](https://capacitorjs.com/docs/apis/push-notifications)

### 9.3 Web a PWA

Webová nastavení nesmějí slibovat nativní funkce, které v daném prohlížeči nejsou dostupné. V první mobilní verzi jsou obě kategorie upozornění povinné na iOS. Web Push je samostatná navazující etapa, pokud má být podporováno upozorňování i bez nativní aplikace; web zůstává plně použitelný bez něj.

Na iOS může Web Push fungovat pro webové aplikace přidané na plochu od iOS 16.4, s oprávněním vyžádaným po akci uživatele. To neumožňuje WidgetKit widget a nepředstavuje spolehlivý lokální denní časovač PWA. [WebKit: Web Push na iOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)

## 10. Návrh databáze

Následující schéma je implementační návrh. Názvy lze změnit, ale vztahy, integrita a oprávnění musí zůstat zachované. Používat UUID, časové značky v UTC a samostatná kalendářní data denního plánu.

| Tabulka | Hlavní pole a omezení |
| --- | --- |
| `profiles` | `id` → auth.users, volitelné zobrazované jméno, created_at; role není uživatelsky editovatelná |
| `user_roles` | user_id, role; zápis pouze důvěryhodnou serverovou operací |
| `quotes` | id, text, status, submitted_by nullable, image_path nullable, image_alt, first_published_at nullable, created_at, updated_at, version, legacy_id unique nullable |
| `moderation_events` | id, quote_id, admin_id, action, from_status, to_status, interní poznámka, created_at; neveřejné |
| `daily_quotes` | date unique, quote_id, selection_source manual/automatic, revision, updated_at |
| `installations` | id, platform, credential_hash, user_id nullable, timezone, last_seen_at; omezená serverová správa |
| `notification_preferences` | installation_id unique, daily_enabled, daily_time, new_quotes_enabled; systémové oprávnění evidovat odděleně od přání uživatele |
| `push_endpoints` | installation_id, provider, token/subscription, updated_at; neveřejné |
| `publication_batches` | id, created_by, created_at; identita hromadného publikování |
| `publication_items` | batch_id, quote_id, unique quote_id pro první publikaci |
| `notification_outbox` | event_id unique, batch_id, status, attempts, next_attempt_at, last_error; neveřejné |
| `notification_deliveries` | event_id + endpoint_id unique, stav pokusu, provider_message_id; pro řízení opakování |

Oddělit interní data od veřejného kontraktu. U veřejných obrázků počítat s tím, že jednou distribuované soubory mohou zůstat v cache. Neschválené uploady držet v privátním stagingu. Při publikaci zajistit bezpečné zpřístupnění a při skrytí odvolat další běžný přístup; neprezentovat to jako odstranění všech již stažených kopií. [Supabase Storage](https://supabase.com/docs/guides/storage)

RLS a serverová validace musí zabránit podvržení autora, vložení stavu approved, změně stavu uživatelem, eskalaci role a čtení cizích návrhů. Kontrolovat také navázaná média a budoucí denní plán. `service_role` nesmí být dostupná ve webu, aplikaci ani widgetu.

## 11. Datové kontrakty

Konkrétní transport může být Supabase query/RPC nebo serverové HTTP API. Zachovat minimálně tyto logické operace:

- `listPublishedQuotes(cursor, limit)` — stránkovaná veřejná data bez soukromých polí.
- `getPublishedQuote(id)` — detail pouze schváleného záznamu.
- `getDailyPlan(fromDate, days<=7)` — datum, quoteId, text, volitelný obrázek, revize, generatedAt a platnost.
- `submitQuote(text, requestId)` — ověřený účet, server určuje autora a stav, idempotence.
- `listOwnSubmissions()` — vlastní záznamy bez interních poznámek.
- `moderateQuotes(ids, action, expectedVersions)` — administrátor, transakce, audit, outbox.
- `setDailyQuote(date, quoteId)` — administrátor; pouze schválený obsah.
- `registerInstallation()` a `updateNotificationPreferences()` — omezený přístup k vlastní instalaci.

Validovat vstupy na klientu i serveru. Chyby mají stabilní kódy a česky srozumitelnou prezentaci. Text renderovat jako text, ne pomocí neověřeného HTML.

## 12. Převod dat

Vstupy dodá zadavatel: SQL/CSV/JSON export existující MySQL databáze a adresář obrázků nebo jejich mapování. Export může připravit v phpMyAdmin. Bez exportu nevytvářet zdání, že všech přibližně 100 mouder už bylo importováno.

Postup: záloha → prohlédnutí skutečného schématu → mapování → dry run → report → potvrzený produkční import. Zachovat text, diakritiku, vazby obrázků a původní identifikátory v legacy_id. Duplicity a chybějící obrázky reportovat, neslučovat potichu. Existující publikační stavy převzít; nejsou-li dostupné, použít pending, dokud vlastník výslovně nepotvrdí hromadné schválení. Import je opakovatelný bez zdvojení dat a bez spuštění push zpráv. Původní web a databázi nesmazat.

## 13. Kvalita, dostupnost a offline režim

- Responzivní rozhraní od 320 px po desktop, bez nechtěného vodorovného posuvu.
- Podpora safe areas iPhonu, klávesnice, návratu v navigaci a orientace.
- Oba režimy mají čitelný kontrast; ovládání má popisky, viditelný focus a dostatečně velké dotykové plochy.
- Respektovat `prefers-reduced-motion`, zvětšení textu a čtečky obrazovky.
- Obrázky optimalizovat, rezervovat rozměry a načítat podle potřeby. Pro cca 100 mouder není nutná složitá infrastruktura.
- Webová PWA cachuje aplikační shell a omezený veřejný obsah; mobilní aplikace a widget mají vlastní vhodnou veřejnou cache.
- Offline zobrazit uložená moudra a stav připojení. Nepředstírat odeslání návrhu, pokud server nepotvrdil přijetí; automatická offline fronta návrhů není v první verzi.
- Nikdy veřejně necachovat administrační odpovědi, soukromé návrhy nebo přístupové tokeny.
- Smazaný/skrytý obsah odstranit z cache po další synchronizaci; okamžitá aktualizace offline zařízení není garantována.
- Logovat provozní chyby a neúspěšné notifikace bez hesel, tokenů a zbytečných osobních údajů.
- Před vydáním ověřit aktuální podmínky App Storu, proces účtů, ochranu soukromí a moderaci uživatelského obsahu; schválení obchodem není garantovaný výsledek vývoje.

## 14. Etapy realizace

| Etapa | Výstup a podmínka dokončení |
| --- | --- |
| 0 — technické ověření | Minimální React/Vite/Capacitor aplikace na skutečném iPhonu, widget s předem připravenou denní timeline, otevření detailu a zkušební lokální/push upozornění. Zapsat poskytovatele push a požadavky na podpisy. |
| 1 — webové rozhraní | Carousel, detail, oba barevné režimy, responzivita a prázdné/chybové stavy. Do dodání databáze jasně označená demonstrační data, nikoli fingovaná autentizace. |
| 2 — backend | Supabase migrace, Auth, RLS, návrhy, administrace, obrázky a audit. Oprávnění ověřena přímými API testy. |
| 3 — denní obsah | Denní plán, administrátorská volba, automatický výběr, offline veřejná cache a migrační nástroj. |
| 4 — iOS funkce | Produkční widget, deep links, předvolby a denní připomínka, serverové push zprávy s outboxem. Ověření skutečného zařízení. |
| 5 — předání a vydání | Import skutečných dat, nasazení webu, dokumentace, iOS build pro TestFlight a následný proces vydání. |

Android, jeho vlastní widget a webové push notifikace jsou oddělené navazující etapy, pokud je vlastník zařadí do rozsahu. Neprezentovat hotový web jako hotovou mobilní aplikaci.

## 15. Akceptační kritéria

1. Nepřihlášený návštěvník vidí pouze schválená moudra a může používat carousel dotykem i klávesnicí.
2. Texty s obrázkem i bez něj fungují ve světlém/tmavém režimu, na úzkém displeji i při zvětšení textu.
3. Volba vzhledu přežije restart; systémová volba reaguje na změnu systému.
4. Neověřený nebo nepřihlášený uživatel neodešle návrh ani přímým API požadavkem.
5. Ověřený uživatel odešle pending návrh a vidí vlastní stav; nevidí cizí návrhy a neumí měnit ani mazat své odeslané záznamy.
6. Pokus podvrhnout autora, approved stav nebo admin roli selže na serveru/databázi.
7. Administrátorské schválení zveřejní obsah; zamítnutí jej nezveřejní; skrytí odebere obsah z veřejného API i po přímém otevření URL.
8. Opakované schválení nebo editace nevytvoří novou prvotní publikační událost; hromadná publikace vytvoří jednu dávku.
9. Moudro dne je stejné na webu, v aplikaci a widgetu pro stejné datum Europe/Prague, s ohledem na offline cache a systémové časování.
10. Manuální denní výběr má přednost; nula/jedno moudro, skrytí naplánovaného obsahu i změna letního času mají definované chování.
11. Widget se při dostupné timeline mění bez nutnosti denně otevírat aplikaci. Ověřit na zařízení, při výpadku sítě i po vypršení cache; nezaměňovat simulovanou změnu data za ověřený běh přes noc.
12. Klepnutí na widget, denní připomínku i push otevře správný cíl při zavřené i otevřené aplikaci.
13. Denní připomínka a nové publikace se zapínají nezávisle. Odmítnutí systémového oprávnění a vypnutí předvolby jsou správně zohledněny.
14. Nová publikace vyvolá serverovou push zprávu i při zavřené aplikaci; pending návrh ani import ji nevyvolá.
15. Opakování neúspěšné úlohy, rotace tokenu a hromadná publikace nezpůsobují nekontrolované násobení zpráv.
16. Opakovaný dry run/import nezdvojí moudra, zachová český text a vytvoří report chybějících obrázků.
17. Ve výsledném webovém/mobilním balíčku ani repozitáři nejsou serverové klíče; soukromá data nejsou ve veřejné cache.
18. Předání obsahuje funkční build, migrace, popsanou konfiguraci, výsledky ověření a přesný seznam dosud neověřených kroků.
19. Desktop a mobil vizuálně odpovídají části 5.7: modrá sova v záhlaví, dominantní středová karta, patková typografie hlášek, kobaltové akce a mobilní spodní navigace. Porovnat snímky skutečného rozhraní s referencí při reprezentativní desktopové šířce a na mobilu ve světlém i tmavém režimu.
20. Logo zůstává čitelné v malých velikostech a má bílé vnitřní plochy i v dark režimu. Dekorativní texty, doména, rámečky zařízení a neschválená moudra z prezentačního náhledu nejsou automaticky přeneseny do produkce.

Testy zaměřit na skutečná rizika: RLS a stavy publikace, idempotenci, data/časové zóny, import, deep links a doručování. Doplnit několik integračních průchodů hlavními obrazovkami; nepsat velké množství testů, které pouze kopírují implementaci. Widget, notifikace a mobilní oprávnění vyžadují ověření na skutečném iPhonu.

## 16. Co musí dodat vlastník před produkčním dokončením

- Export databáze a soubory obrázků včetně jejich vazeb.
- Supabase projekt nebo oprávnění jej založit a nakonfigurovat; přístupy předávat bezpečně, ne do repozitáře.
- E-mail budoucího administrátora a způsob doručování ověřovacích e-mailů.
- Doménu a zvolené hostování, případně souhlas se zvolenou službou.
- Pro iOS Apple Developer účet, identifikátor aplikace a přístup k podepisování; prostředí s macOS/Xcode a testovací iPhone.
- Konfiguraci APNs/FCM podle zvoleného transportu push zpráv.
- Kontaktní a obsahové podklady pro podporu, ochranu soukromí a vydání v obchodě.

Chybějící externí přístupy nebrání přípravě rozhraní, migrací, kontraktů a testů. Brání však tvrzení, že produkční autentizace, import, push a publikace v App Storu už fungují. Placené služby a produkční změny realizovat až s příslušným oprávněním vlastníka.

## 17. Předání zdrojů a spolupráce Codex + Claude

Jeden společný Git repozitář, jeden zdroj pravdy pro zadání. Doporučená struktura: webová aplikace v `src/`, nativní projekt v `ios/`, migrace a serverové funkce v `supabase/`, dokumentace v `docs/`. Widget extension je součást iOS projektu. Přesné uspořádání přizpůsobit scaffoldingu a zapsat.

Předat README s lokálním spuštěním, `.env.example` bez tajných hodnot, databázové migrace a seed, importní skript s dry run, návod na administrátora, nasazení a rollback, konfiguraci widgetu/push, výsledky ověření a seznam omezení. Mít stručný rozhodovací deník `docs/decisions.md` a stav etap `docs/status.md`.

Pokud oba asistenti pracují souběžně, rozdělit konkrétní úkoly a soubory, používat samostatné větve a vzájemný review. Nedávat oběma současně úkol přepsat celý projekt. Při změně databázového nebo widgetového kontraktu nejprve aktualizovat společný popis. Nedokončené integrace jasně označit; funkční ukázka není automaticky produkčně dokončená funkce.

## 18. Úvodní instrukce pro implementačního asistenta

Součástí vizuálního zadání je část 5.7. Při předání přilož také schválený náhled a samostatnou modrou sovu uvedené v této části. Implementační asistent má zachovat tento designový směr a nevytvářet jinou identitu od nuly. Pokud obrázky nemá, má pracovat podle textové specifikace a chybějící originální asset uvést mezi podklady potřebnými k finálnímu vizuálnímu ověření.

> Vytvoř projekt Honzíkova moudra podle přiloženého zadání. Nejdřív si přečti celý dokument a existující instrukce repozitáře. Zachovej React, TypeScript, Tailwind, Vite, Capacitor a Supabase; nezačínej jinou architekturou bez konkrétního důvodu. Rozlišuj potvrzené požadavky, doporučené výchozí volby a funkce mimo první verzi. Začni krátkým plánem etap a technickým ověřením iOS widgetu, deep links a notifikací. Pokud nemáš prostředí pro iOS, připrav příslušný kód a postup ověření, současně pokračuj webem a backendem, ale nativní funkce neoznačuj za ověřené. Implementuj postupně funkční celky, zapisuj rozhodnutí a stav. Oprávnění vynucuj na serveru/RLS, nikoli jen v rozhraní. Nepřidávej uživatelské úpravy či mazání mouder, oblíbené, komentáře ani další neobjednané funkce. Demo data označ a nenahrazuj jimi skutečné napojení bez upozornění. Po každé etapě uveď, co funguje, jak to bylo ověřeno a jaké konkrétní přístupy nebo data ještě chybí. Před produkčním vydáním projdi akceptační kritéria v tomto dokumentu.
