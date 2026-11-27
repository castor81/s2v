# S2V – Scan2Vote változásnapló v1.8 (2026-11-27) – v0.6.0

## Változások
- HU/EN nyelvváltó: billenő (rocker) switch, `role="switch"`, `aria-checked`.
- Oldalsó glassmorphic sidebar (NKE színsémával): szerkesztői és master felület; mobilon lenyíló menü.
- Szerkesztői kódok: 8 számjegy, sózott SHA-256 tárolás; számkódos belépőoldal (`/uj`), előzetes ellenőrzés (`check:true`, nem számít felhasználásnak).
- Kódkitalálás elleni védelem: `gatefail` zárolás 8 hiba/perc/IP.
- Új master fülek: Szavazástervező, QR-kódok és linkek, Statisztika.
- Forgó NKE-logó (`public/brand/nke-logo-spin.gif`, saját generálású), reduced-motion tartalék.

## Megjegyzések
- A betűs általános kód (`CREATE_GATE_CODE`) a belépőfelületen nem használható.
- Meglévő (betűs) adatbázis-kódok nem voltak kiadva; új kódokat a master „Szerkesztői kódok” fülén kell létrehozni.
- Tesztek: 48/48, tsc és build hibamentes.
