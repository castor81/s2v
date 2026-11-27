# S2V – Scan2Vote változásnapló v2.3 (2026-11-27) – v0.9.1

- Válaszlehetőségek felső határa 10 → 50 (kérés: 30 fős jelöltlistás szavazás).
- Érintett: api/_lib/validate.ts (OPTIONS_MAX), ContentFields (MAX), feliratok HU/EN (2–50, import súgó).
- Teszt: 30 és 50 lehetőség elfogadva, 51 elutasítva (65/65 teszt sikeres).
