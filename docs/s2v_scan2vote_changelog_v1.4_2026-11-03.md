# S2V - Scan2Vote · Changelog

Verzió: v1.4 · Dátum: 2026-11-03 · Verziónként a változások listája (G4 artefaktum)

## 0.3.0 · 2026-11-03 · Ütemezett szavazás és élő rangsor

**Hozzáadva**
- Időzítés: a szavazás létrehozásakor megadható a nyitás és a zárás időpontja (böngésző helyi ideje, az időzóna a felületen látszik). A nyitás akár hetekkel (legfeljebb 1 évvel) előre programozható; üresen a szavazás azonnal nyílik, illetve kézzel zárható. Szabályok: a zárás a jövőben legyen, a nyitás után legalább 1 perccel; múltbeli nyitás = azonnal.
- Módosítás: `POST /api/update`. Nyitás előtt (és szavazat nélkül) a cím, a lehetőségek, a nyitás és a zárás módosítható; nyitott szavazásnál csak a zárás időpontja; lezárt szavazásnál újranyitás után.
- Szavazóoldal: induló szavazásnál kiírja a nyitás időpontját, és a nyitás pillanatában magától megnyílik (0–8 mp véletlen késleltetéssel, hogy a terem telefonjai ne egyszerre kérdezzenek); nyitott szavazásnál kiírja a zárás időpontját.
- Szervezői dashboard: az eredménylista szavazatszám szerint csökkenő sorrendben, élőben rendeződik (animált átrendeződés; csökkentett mozgás beállításnál animáció nélkül); azonos szavazatszámnál azonos helyezés és az eredeti sorrend; az élen állót a képernyőolvasó is bemondja. Frissítés 3 másodpercenként. Az ütemezés és a módosító felület a dashboardon.
- Migráció `0002_purge_window.sql`: a törlési függvény a `closed_at` hiányában a `closes_at` időpontot veszi lezárásnak, így az időablakkal lezáruló szavazások is törlődnek 30 nap után (KM-dev adatbázison alkalmazva és ellenőrizve).
- Tesztek: időzítés-ellenőrzés és rangsor (összesen 19 teszt).

**Ismert korlát**
- Az a szavazás, amelyet soha nem zárnak le és nincs zárási időpontja, nem törlődik automatikusan. Ajánlott zárási időpontot megadni.

**Következő:** n8n napi törlés, WCAG 2.2 AA ellenőrzés, a G4 működő szelet.

## 0.2.1 · 2026-11-03 · 2. iteráció, 2. rész: NKE arculat

**Hozzáadva**
- Alapháttér: az arculati kézikönyv mintája átlátszó csempeként (`public/brand/pattern-tile.png`, az elsődleges `#645d45` színnel, kb. 20% fedéssel), a háttérszín átlátszik rajta. A tartalom fehér felületen van, a minta nem rontja az olvashatóságot.
- Fejléc: NKE HHK logó (kör alakú kivágással, átlátszó sarkokkal), kétnyelvű intézménynév, arany `#b5850f` alsó vonal.
- Lábléc: NKE logó (dekoratív, a név szövegként is szerepel) és az intézmény neve.
- Színek az arculati kézikönyvből: `#262a3d` szöveg, `#645d45` gombok, `#a43b26` hibák, `#918867` keretek, `#585857` halvány szöveg. Minden szín-pár WCAG 2.2 AA kontrasztú (szöveg 12,8:1; gomb 6,6:1; hiba 6,5:1; keret 3,5:1).
- Betűtípus: Open Sans (a kézikönyv kiegészítő betűtípusa), a csomagból helyben kiszolgálva (latin + latin-ext a magyar ő/ű miatt, külső betűtípus-szolgáltatás nélkül); az embléma betűtípusa (Times New Roman) az intézménynévnél.

**Megjegyzés**
- A minta forrása az arculati kézikönyv képernyőképe (kis felbontású); éles, nagyobb nyomtatású vagy 2x kijelzős használathoz vektoros (SVG) minta kérendő, ami élesebb.

**Következő (2. iteráció, további részek):** n8n napi törlés, WCAG 2.2 AA ellenőrzés (billentyűzet, olvasó, kontraszt, nagyítás), a G4 működő szelet.

## 0.2.0 · 2026-11-03 · 2. iteráció, 1. rész: szervezői dashboard

**Hozzáadva**
- `POST /api/results`: a szervezői token alapján (csak hash-e tárolt) visszaadja a szavazást, az eredményeket és a mérőszámokat (leadási arány, medián idő a szavazatig). F7.
- `POST /api/status`: a szervező lezárhatja és újranyithatja a szavazást; a lezárás rögzíti a `closed_at` időpontot (a 30 napos megőrzés kezdete). F4.
- Szervezői felület (`/o/<token>`): állapot, négy mérőszám, eredménytábla (szám + százalék + sáv, nem csak szín), 5 mp-es automatikus frissítés nyitott szavazásnál, kétlépéses lezárás-megerősítés, QR újranyomtatás, `noindex`.
- Biztonsági fejlécek: `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`.
- Tesztek: statisztika és token-ellenőrzés (összesen 13 teszt).

**Változott**
- A QR- és másolómező-komponens közös komponensbe került (`src/components`), a létrehozó oldal és a dashboard is ezt használja.
- A terheléspróba (300 szavazó, 60 mp, GitHub Actions) lefutott: 300/300 sikeres szavazat, 0% hiba, a duplikált szavazat elutasítva. A próbaadatok törölve.

**Következő (2. iteráció, további részek):** NKE / NKE HHK arculat (logók, vízjel), n8n napi törlés, WCAG 2.2 AA ellenőrzés, a G4 működő szelet.

## 0.1.1 · 2026-11-03 · Bekötés (Supabase + Vercel)

**Módosítva**
- A rövid cím **`s2vote.vercel.app`** lett (az `s2v.vercel.app` foglalt volt egy másik csapatnál); `BASE_URL`, `.env.example`, README és a terheléspróba-szkript frissítve.
- Vercel: a függvények régiója `fra1` (Frankfurt), az adatbázis közelében.
- Supabase: az S2V séma (`0001_init`) a KM-dev projektben fut, a `polls`, `poll_sessions`, `votes` táblák RLS-sel zárva.

## 0.1.0 · 2026-11-03 · 1. iteráció váza

**Hozzáadva**
- Projektváz: Vite + React + TypeScript kliens, Vercel Functions (Node/TS) háttér, Vercel-konfiguráció (SPA-átirányítás, `no-store` az API-ra).
- Supabase séma (`0001_init.sql`): `polls`, `poll_sessions`, `votes` (UNIQUE `poll_id, device_hash`), RLS zárva, `purge_closed_polls()` a 30 napos törléshez.
- API: `POST /api/create` (belépési kód, szervezői token csak hash-ként tárolva, 6 karakteres slug), `POST /api/open` (session-rögzítés), `POST /api/vote` (egyszeri szavazat, időablak- és opcióellenőrzés).
- Kliens: szavazás létrehozása, QR-generátor (PNG/SVG), szavazóoldal, magyar/angol felület, dashboard-helyőrző.
- Terheléspróba-szkript (`scripts/loadtest.mjs`), segédfüggvény-tesztek, README.

**Döntések**
- Rövid URL: `s2v.vercel.app` (G3 v1.1); később `s2vote.vercel.app`-ra módosult, lásd 0.1.1.
- IP-alapú sebességkorlát alapértéke magas (600/perc): rendezvényen sok szavazó osztozhat egy wifi-IP-n.

**Következő (2. iteráció):** szervezői dashboard és token-ellenőrzés (F7), szavazás nyitása/zárása (F4), n8n napi törlés, WCAG 2.2 AA ellenőrzés, a G4 működő szelet.
