# S2V – Scan2Vote változásnapló v2.0 (2026-11-27) – v0.7.0

- Egyetlen közös belépő oldal (`/`): lakatos 6 jegyű PIN; a szerver (`POST /api/signin`) dönti el a szerepkört (master / szerkesztő). `/uj` és `/master` a kezdőoldalra irányít.
- Szerkesztői kódok: 6 számjegy (korábban 8). A master kóddal azonos kód nem adható ki. Zárolás: 8 sikertelen próba/perc/IP (`signinfail`).
- A szavazás címe és lehetőségei egynyelvűek: egy mező, a szöveg mindkét nyelvi helyre kerül. A HU/EN kapcsoló a felületi feliratokat váltja.
- Master / Szerkesztői kódok: kattintható számsor (1–9, 0, ⌫, Törlés) és „Véletlen kód” gomb.
- Tesztek: 51/51; böngészős folyamatteszt asztali és mobil méretben.

## Megjegyzések
- Régi, 8 jegyű szerkesztői kód nem volt kiadva; a meglévő, korábbi kétnyelvű szavazások szövege szerkesztéskor egynyelvűvé válik.
- 6 jegyű kódnál a kitalálás elleni védelem az IP-zárolás; hosszabb kódra váltás később egyszerű.
