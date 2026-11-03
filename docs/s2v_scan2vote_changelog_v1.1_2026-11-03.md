# S2V - Scan2Vote · Changelog

Verzió: v1.1 · Dátum: 2026-11-03 · Verziónként a változások listája (G4 artefaktum)

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
