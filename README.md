# S2V · Scan2Vote

QR-kódos, tét nélküli közönségszavazó webalkalmazás (NKE HHK). Dokumentáció: projektprofil v1.0, G2 követelmény-alapvonal v1.1, G3 architektúra v1.1.

**Állapot:** 2. iteráció, 4. rész (v0.5.0) · 2026-11-03

## Mi van benne (1. iteráció)

- szavazás létrehozása belépési kóddal (`/uj`), magyar/angol tartalommal
- QR-generátor (PNG/SVG letöltés) és a szöveges rövid cím a kód alatt
- szavazóoldal (`/<slug>`), egyválasztós, magyar/angol felület
- eszközönként egy szavazat szavazásonként (adatbázis-megszorítás)
- szervezői token generálása (csak a hash-e tárolódik)
- szervezői felület (`/o/<token>`): élő, szavazatszám szerint rendeződő eredmények, mérőszámok, lezárás/újranyitás, QR újranyomtatás
- élő állás a szavazóknak a szavazat leadása után (csak szavazott eszközről érhető el)
- időzítés: nyitás/zárás időpontja (akár hetekkel előre), módosítás nyitás előtt
- terheléspróba-szkript (300 szavazó)

## Szerkezet

```
api/            Vercel Functions (Node/TS): create, open, vote, live, results, status, update  +  _lib (crypto, validáció, statisztika, http)
src/            React + Vite + TS kliens (titkot nem tartalmaz)
public/brand/   NKE HHK és NKE logó, átlátszó háttérminta (arculati kézikönyv)
supabase/       migrations/0001_init.sql (polls, poll_sessions, votes; RLS zárva)
scripts/        loadtest.mjs
tests/          api-lib.test.ts, stats.test.ts, schedule.test.ts, handlers.test.ts
docs/           changelog
```

## Indítás

1. **Supabase:** hozzon létre egy fejlesztői projektet, majd futtassa a `supabase/migrations/0001_init.sql` fájlt (SQL Editor, vagy `supabase db push`). Éles példányhoz külön projekt kell.
2. **Környezeti változók:** `.env.example` → `.env.local` (helyben), illetve Vercel → Project Settings → Environment Variables. A `SUPABASE_SERVICE_ROLE_KEY` és a `CREATE_GATE_CODE` titok, a kliensbe nem kerülhet.
3. **Vercel:** importálja a repót `s2v` néven, a projekthez vegye fel az `s2vote.vercel.app` domaint; a `BASE_URL` legyen `https://s2vote.vercel.app`. A `SUPABASE_SERVICE_ROLE_KEY` Production és Preview környezetben is legyen beállítva (Sensitive). A függvények régiója `fra1` (az adatbázis is EU-ban van).
4. **Helyi futtatás:** `npm install`, majd `vercel dev` (az `/api` függvényekkel együtt; a sima `npm run dev` csak a klienst indítja).

## Parancsok

```
npm run typecheck   típusellenőrzés
npm test            segédfüggvények tesztje
npm run build       típusellenőrzés + produkciós build
BASE_URL=https://s2vote.vercel.app GATE_CODE=... npm run loadtest   # 300 szavazó 60 mp alatt
```

## Ismert korlátok (tudatosan vállalt, lásd G2 K1)

- Az eszközazonosító a böngésző tárhelyében él; törlésével újra lehet szavazni. Tét nélküli szavazásnál elfogadott.
- Az IP-alapú sebességkorlát példányonkénti (in-memory), és szándékosan magas (alapérték 1500/perc), mert rendezvényen sok szavazó lehet ugyanazon a wifi-IP mögött. Ez csak visszaélés elleni alapvédelem; a duplikációt az adatbázis UNIQUE megszorítása akadályozza meg.
- A 30 napos törlés (`purge_closed_polls`) ütemezése (n8n) a 2. iteráció következő részében kerül be. A soha le nem zárt, zárási időpont nélküli szavazás nem törlődik automatikusan: érdemes zárási időpontot megadni.


## Master felület (v0.5.0)

Cím: `/master` (belépés a `MASTER_CODE` kóddal; a kód csak a böngészőlap munkamenetében marad meg).

- **Szavazások:** futó, betervezett és lezárt szavazások eredményekkel, szűrés (állapot, projekt, keresés), rendezés, archiválás, CSV-export.
- **Szerkeszthetőség:** a nyitás előtti szavazás teljesen módosítható; a futó szavazás nem (csak lezárható); lezárt újranyitható vagy törölhető. Másolás sablonként, új szervezői hivatkozás elveszett link esetére.
- **Projektek:** szavazások csoportosítása, projektenkénti export.
- **Szerkesztői kódok:** tetszőleges számú kód (egyedi vagy generált), projekthez köthető, lejárattal, kikapcsolható; csak a sózott lenyomat tárolódik. Az általános `CREATE_GATE_CODE` továbbra is érvényes.
- Adatbázis: a `0003_master.sql` az `s2v_projects` és `s2v_access_codes` táblákat hozza létre (a közös KM-dev projektben más alkalmazás is használ `projects` nevű táblát).
