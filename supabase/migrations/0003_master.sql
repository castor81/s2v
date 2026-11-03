-- S2V - Scan2Vote · 0003_master · 2026-11-03
-- Az S2V táblák s2v_ előtagot kapnak: a KM-dev projekt public sémájában más alkalmazások is vannak.
-- Master felület: projektek, szerkesztői kódtár, archiválás, összesítő lekérdezés.
-- Minden tábla RLS-sel védett, policy nélkül: csak a háttér (service role) éri el.

create table public.s2v_projects (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);
create unique index s2v_projects_name_uq on public.s2v_projects (lower(name));

-- A kód maga nem tárolódik, csak sózott SHA-256 lenyomata.
create table public.s2v_access_codes (
  id           uuid primary key default gen_random_uuid(),
  label        text not null check (char_length(label) between 1 and 80),
  code_hash    text not null unique,
  project_id   uuid references public.s2v_projects(id) on delete set null,
  active       boolean not null default true,
  expires_at   timestamptz,
  use_count    integer not null default 0,
  last_used_at timestamptz,
  created_at   timestamptz not null default now()
);

alter table public.polls
  add column project_id  uuid references public.s2v_projects(id) on delete set null,
  add column code_id     uuid references public.s2v_access_codes(id) on delete set null,
  add column archived_at timestamptz;

create index polls_project_idx on public.polls (project_id);
create index polls_created_idx on public.polls (created_at desc);

alter table public.s2v_projects     enable row level security;
alter table public.s2v_access_codes enable row level security;

-- Szavazatszámok egy lekérdezésben a master áttekintőhöz (szavazásonként egy sor).
create or replace function public.master_poll_counts()
returns table (poll_id uuid, votes bigint, sessions bigint, counts jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select p.id,
         (select count(*) from public.votes v where v.poll_id = p.id),
         (select count(*) from public.poll_sessions s where s.poll_id = p.id),
         coalesce(
           (select jsonb_object_agg(c.option_id, c.n)
              from (select v.option_id, count(*) as n
                      from public.votes v where v.poll_id = p.id
                     group by v.option_id) c),
           '{}'::jsonb)
    from public.polls p
$$;

revoke all on function public.master_poll_counts() from public, anon, authenticated;
