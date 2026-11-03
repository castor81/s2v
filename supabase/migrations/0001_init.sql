-- S2V - Scan2Vote · 0001_init · 2026-11-03
-- G3 architektúra v1.1 adatmodellje.
-- A kliens NEM éri el közvetlenül a táblákat: az RLS be van kapcsolva és
-- szándékosan nincs policy, így csak a háttér-API (service role) fér hozzá.

create extension if not exists pgcrypto;

create table public.polls (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text not null unique check (slug ~ '^[a-z0-9]{6}$'),
  title                 jsonb not null,   -- {"hu": "...", "en": "..."} (legalább egy nyelv)
  options               jsonb not null,   -- [{"id": "o1", "hu": "...", "en": "..."}, ...]
  status                text not null default 'open' check (status in ('draft', 'open', 'closed')),
  opens_at              timestamptz,
  closes_at             timestamptz,
  closed_at             timestamptz,
  organizer_token_hash  text not null unique,   -- SHA-256 hex; a token maga sehol nem tárolódik
  created_at            timestamptz not null default now()
);

create table public.poll_sessions (
  id            uuid primary key default gen_random_uuid(),
  poll_id       uuid not null references public.polls(id) on delete cascade,
  device_hash   text not null,
  first_seen_at timestamptz not null default now(),
  voted_at      timestamptz,
  unique (poll_id, device_hash)
);

create table public.votes (
  id          uuid primary key default gen_random_uuid(),
  poll_id     uuid not null references public.polls(id) on delete cascade,
  option_id   text not null,
  device_hash text not null,
  created_at  timestamptz not null default now(),
  -- F3: eszközönként egy szavazat szavazásonként
  constraint votes_one_per_device unique (poll_id, device_hash)
);

create index votes_poll_option_idx on public.votes (poll_id, option_id);
create index poll_sessions_poll_idx on public.poll_sessions (poll_id);
create index polls_closed_at_idx on public.polls (closed_at) where closed_at is not null;

alter table public.polls         enable row level security;
alter table public.poll_sessions enable row level security;
alter table public.votes         enable row level security;
-- Nincs policy: anon/authenticated szerepkör semmit sem lát. A service role megkerüli az RLS-t.

-- A lezárt szavazások törlése (A1: closed_at + 30 nap). Az n8n naponta hívja,
-- a 2. iterációban kötjük be. A cascade viszi a sessions/votes sorokat is.
create or replace function public.purge_closed_polls(retention_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.polls
   where closed_at is not null
     and closed_at < now() - make_interval(days => retention_days);
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.purge_closed_polls(integer) from public, anon, authenticated;
