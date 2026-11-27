# S2V – Scan2Vote változásnapló v2.1 (2026-11-27) – v0.8.0

- Direktor kód (`DIRECTOR_CODE`): a master jogosultságaival, közös belépő oldalon (`/api/signin` → `role: director`).
- Tevékenységnapló (`s2v_audit_log`, migráció 0004): master, direktor, szerkesztői kódok és szervezői linkek tevékenysége; pillanatfelvétel-szerű nevek, kódértékek nélkül.
- Master / direktor: új „Napló” menüpont, szűrők: ki, projekt, szavazás, tevékenység, időszak (szerveroldali), szabad szöveg; napokra bontott időrend, további bejegyzések lapozása.
- Tesztek: 55/55 (új: direktor belépés és ütközés, naplózás, pillanatfelvétel törlés után, kódérték hiánya, szervezői lezárás naplózása, audit.list szűrés); böngészős folyamatteszt asztali és mobil méreten.

## Megjegyzések
- Sikertelen belépési kísérletek nem naplózódnak (az IP-zárolás védi őket); kérésre felvehető.
- A napló megőrzése korlátlan; igény esetén időkorlát (pl. 12 hónap) bevezethető.
