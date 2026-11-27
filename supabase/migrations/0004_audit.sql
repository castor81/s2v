-- S2V - Scan2Vote · 0004_audit · 2026-11-27
-- Tevékenységnapló: ki (master / direktor / szerkesztői kód / szervezői link) mit csinált.
-- A tábla szándékosan nem hivatkozik idegen kulccsal a szavazásokra, projektekre és kódokra:
-- a bejegyzés pillanatnyi nevet (pillanatfelvételt) őriz, ezért a törlés után is olvasható marad.
-- A kódok értéke soha nem kerül a naplóba. RLS bekapcsolva, policy nélkül: csak a háttér (service role) éri el.

create table public.s2v_audit_log (
  id           uuid primary key default gen_random_uuid(),
  at           timestamptz not null default now(),
  actor_role   text not null check (actor_role in ('master', 'director', 'editor', 'organizer')),
  actor_label  text,
  code_id      uuid,
  action       text not null check (char_length(action) between 1 and 40),
  project_id   uuid,
  project_name text,
  poll_id      uuid,
  poll_slug    text,
  poll_title   text,
  detail       jsonb
);

create index s2v_audit_at_idx on public.s2v_audit_log (at desc);

alter table public.s2v_audit_log enable row level security;
