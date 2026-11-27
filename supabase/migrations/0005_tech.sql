-- S2V - Scan2Vote · 0005_tech · 2026-11-27
-- A szavazások technikai lefolyása: hívásszámok percenkénti bontásban (végpont × kimenet, válaszidővel)
-- és a szerveroldali hibák egyenként. Személyes adat nincs benne (eszköz- és IP-azonosító sem).
-- Nincs idegen kulcs: a szavazás törlése után is megmarad. RLS bekapcsolva, policy nélkül (csak a háttér éri el).

create table public.s2v_tech_hits (
  bucket    timestamptz not null,             -- a perc kezdete
  poll_key  text        not null default '',  -- szavazás slug-ja; üres = ismeretlen szavazás
  poll_id   uuid,
  endpoint  text        not null check (char_length(endpoint) between 1 and 20),
  outcome   text        not null check (char_length(outcome) between 1 and 40),
  n         integer     not null default 0,
  ms_sum    bigint      not null default 0,
  ms_max    integer     not null default 0,
  primary key (bucket, poll_key, endpoint, outcome)
);
create index s2v_tech_hits_poll_idx on public.s2v_tech_hits (poll_key, bucket desc);

create table public.s2v_tech_errors (
  id        uuid primary key default gen_random_uuid(),
  at        timestamptz not null default now(),
  poll_id   uuid,
  poll_slug text,
  endpoint  text not null,
  status    integer not null,
  error     text,
  message   text
);
create index s2v_tech_errors_at_idx on public.s2v_tech_errors (at desc);

alter table public.s2v_tech_hits   enable row level security;
alter table public.s2v_tech_errors enable row level security;

-- Atomikus növelés: egy hívás = egy sor frissítése (nincs olvasás-módosítás-írás verseny).
create or replace function public.s2v_tech_hit(
  p_poll_id uuid, p_slug text, p_endpoint text, p_outcome text, p_n integer, p_ms_sum bigint, p_ms_max integer
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.s2v_tech_hits (bucket, poll_key, poll_id, endpoint, outcome, n, ms_sum, ms_max)
  values (date_trunc('minute', now()), coalesce(p_slug, ''), p_poll_id, p_endpoint, p_outcome, p_n, p_ms_sum, p_ms_max)
  on conflict (bucket, poll_key, endpoint, outcome) do update
    set n      = public.s2v_tech_hits.n + excluded.n,
        ms_sum = public.s2v_tech_hits.ms_sum + excluded.ms_sum,
        ms_max = greatest(public.s2v_tech_hits.ms_max, excluded.ms_max),
        poll_id = coalesce(public.s2v_tech_hits.poll_id, excluded.poll_id)
$$;
revoke all on function public.s2v_tech_hit(uuid, text, text, text, integer, bigint, integer) from public, anon, authenticated;
