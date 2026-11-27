# S2V – Scan2Vote változásnapló v2.2 (2026-11-27) – v0.9.0

## Technikai napló
- Új táblák: `s2v_tech_hits` (percenkénti hívásszám végpont × kimenet szerint, válaszidő összeg/max.), `s2v_tech_errors` (szerveroldali hibák egyenként); atomikus növelő függvény `s2v_tech_hit` (migráció 0005).
- Naplózott végpontok: open, vote, live, results, update, status. Kimenetek: ok, már szavazott, nem nyitott, érvénytelen kérés/válasz, nem található, 429, szerverhiba. A 429-es hívás is a szavazáshoz kötődik (slug a kérésből).
- Master/direktor: Napló → „Technikai lefolyás”: összesítő, szavazásonkénti bontás, hibalista; szűrők: projekt, szavazás, időszak, csak problémás hívások.
- Megjegyzés: a `live` és `results` sikeres hívásai ~20 mp-enként összegződnek (közelítő); a naplózás hibája nem akadályozza a kiszolgálást.

## Lehetőség-import
- Excel (.xlsx), CSV, TXT; húzás vagy gomb; minta CSV; első kitöltött oszlop; fejléc-felismerés; ismétlődés/üres sor kihagyása; 80 karakter; legfeljebb 10 lehetőség; meglévő sorok megmaradnak.
- Böngészőben feldolgozva (nincs feltöltés); fflate lazy chunk (~5,5 KB).

## Tesztek
- 65/65 (új: technikai napló 3, import 7); böngészős folyamatteszt asztali és mobil méretben.
