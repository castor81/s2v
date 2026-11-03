-- S2V 0.3.0: az időablakkal (closes_at) lezáruló szavazások is törlődjenek a megőrzési idő után.
-- A lezárás időpontja: closed_at (kézi lezárás), ennek hiányában closes_at (időablak vége).
create or replace function public.purge_closed_polls(retention_days integer default 30)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  removed integer;
begin
  delete from public.polls
   where coalesce(closed_at, closes_at) is not null
     and coalesce(closed_at, closes_at) < now() - make_interval(days => retention_days);
  get diagnostics removed = row_count;
  return removed;
end;
$$;

-- A jogosultságok nem változnak (csak a service role hívhatja), de a biztonság kedvéért újra rögzítjük.
revoke execute on function public.purge_closed_polls(integer) from public, anon, authenticated;
