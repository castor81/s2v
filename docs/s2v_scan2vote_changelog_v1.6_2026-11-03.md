# S2V – Scan2Vote · changelog v1.6 · 2026-11-03

**Kiadás:** v0.5.0 (2. iteráció, 4. rész) · Kapu: G4 működő szelet felé

## Új
- `/master` felület: áttekintés (futó / betervezett / lezárt, eredményekkel), szűrés, rendezés, részletek, 5 mp-es frissítés.
- Szerkeszthetőség: nyitás előtt teljes módosítás; futó szavazás nem módosítható (csak lezárható); lezárt újranyitható; törlés (futó nem).
- Másolás sablonként, új szervezői hivatkozás, archiválás, CSV-export (szavazás, szűrt lista, projekt).
- Projektek (csoportosítás) és szerkesztői kódtár (egyedi vagy generált kód, projekthez kötés, lejárat, kikapcsolás, használatszámláló).
- Automatikus törlési határidő megjelenítése, figyelmeztetés 7 napon belül.

## Biztonság
- Külön `MASTER_CODE`; 10 sikertelen próba után IP-zárolás (1 perc); a kódtár kódjai csak sózott SHA-256 lenyomatként tárolódnak; CSV-cellák képlet-injekció elleni védelme.

## Adatbázis
- `0003_master.sql`: `s2v_projects`, `s2v_access_codes`, `polls.project_id/code_id/archived_at`, `master_poll_counts()`; RLS be, policy nélkül.

## Tesztek
- 45 automatikus teszt (17 új: hitelesítés, zárolás, szerkesztési szabályok, törlés, másolás, tokencsere, projektek, kódtár, létrehozás kódtárból).

## Nyitott
- Ütemezett törlés (n8n / Vercel Cron) – később; általános belépési kód cseréje; WCAG 2.2 AA ellenőrzés.
