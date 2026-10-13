begin;
create table if not exists public.locations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  accuracy double precision check (accuracy >= 0), speed double precision check (speed >= 0),
  heading double precision, battery_pct int check (battery_pct between 0 and 100), charging boolean,
  updated_at timestamptz not null default now(), sharing_until timestamptz not null,
  foreign key (couple_id, user_id) references public.profiles(couple_id, id) on delete cascade
);
create index if not exists locations_couple_expiry_idx on public.locations(couple_id, sharing_until);
create index if not exists locations_expiry_idx on public.locations(sharing_until);
create table if not exists public.journeys (
  id uuid primary key default gen_random_uuid(), couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, dest_name text not null check (length(dest_name) between 1 and 160),
  dest_lat double precision not null check (dest_lat between -90 and 90), dest_lon double precision not null check (dest_lon between -180 and 180),
  started_at timestamptz not null default now(), arrived_at timestamptz,
  status text not null default 'active' check (status in ('active', 'arrived', 'cancelled')),
  foreign key (couple_id, user_id) references public.profiles(couple_id, id) on delete cascade
);
create index if not exists journeys_couple_user_idx on public.journeys(couple_id, user_id);
create unique index if not exists journeys_one_active_idx on public.journeys(user_id) where status = 'active';
create table if not exists public.saved_places (
  id uuid primary key default gen_random_uuid(), couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, name text not null check (length(name) between 1 and 80),
  lat double precision not null check (lat between -90 and 90), lon double precision not null check (lon between -180 and 180),
  radius_m int not null default 150 check (radius_m between 100 and 5000), notify_partner boolean not null default false,
  foreign key (couple_id, user_id) references public.profiles(couple_id, id) on delete cascade
);
create index if not exists saved_places_couple_user_idx on public.saved_places(couple_id, user_id);
alter table public.locations enable row level security;
alter table public.journeys enable row level security;
alter table public.saved_places enable row level security;
revoke all on public.locations, public.journeys, public.saved_places from public, anon, authenticated;
grant select, insert, update, delete on public.locations, public.journeys, public.saved_places to authenticated;

drop policy if exists locations_read on public.locations;
create policy locations_read on public.locations for select to authenticated using (
  couple_id = (select public.my_couple_id()) and (user_id = (select auth.uid()) or sharing_until > now())
);
drop policy if exists locations_insert on public.locations;
create policy locations_insert on public.locations for insert to authenticated with check (
  user_id = (select auth.uid()) and couple_id = (select public.my_couple_id()) and sharing_until > now()
);
drop policy if exists locations_update on public.locations;
create policy locations_update on public.locations for update to authenticated
  using (user_id = (select auth.uid()) and couple_id = (select public.my_couple_id()))
  with check (user_id = (select auth.uid()) and couple_id = (select public.my_couple_id()) and sharing_until > now());
drop policy if exists locations_delete on public.locations;
create policy locations_delete on public.locations for delete to authenticated using (user_id = (select auth.uid()) and couple_id = (select public.my_couple_id()));

drop policy if exists journeys_read on public.journeys;
create policy journeys_read on public.journeys for select to authenticated using (
  couple_id = (select public.my_couple_id()) and (user_id = (select auth.uid()) or exists (
    select 1 from public.locations l where l.user_id = journeys.user_id and l.couple_id = journeys.couple_id and l.sharing_until > now()
  ))
);
drop policy if exists journeys_insert on public.journeys;
create policy journeys_insert on public.journeys for insert to authenticated with check (
  user_id = (select auth.uid()) and couple_id = (select public.my_couple_id()) and exists (
    select 1 from public.locations l where l.user_id = (select auth.uid()) and l.sharing_until > now()
  )
);
drop policy if exists journeys_update on public.journeys;
create policy journeys_update on public.journeys for update to authenticated
  using (user_id = (select auth.uid()) and couple_id = (select public.my_couple_id()))
  with check (user_id = (select auth.uid()) and couple_id = (select public.my_couple_id()));
drop policy if exists journeys_delete on public.journeys;
create policy journeys_delete on public.journeys for delete to authenticated using (user_id = (select auth.uid()) and couple_id = (select public.my_couple_id()));

-- Saved destinations remain private to their owner; alerts disclose only the chosen name.
drop policy if exists saved_places_owner on public.saved_places;
create policy saved_places_owner on public.saved_places for all to authenticated
  using (user_id = (select auth.uid()) and couple_id = (select public.my_couple_id()))
  with check (user_id = (select auth.uid()) and couple_id = (select public.my_couple_id()));

-- Enforce the region budget even across concurrent devices.
create or replace function public.location_place_limit() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.notify_partner then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('location-places:' || new.user_id::text, 0));
    if (select count(*) from public.saved_places where user_id = new.user_id and notify_partner and id <> new.id) >= 20 then
      raise exception 'At most 20 saved place alerts may be enabled' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.location_place_limit() from public, anon, authenticated;
drop trigger if exists location_place_limit on public.saved_places;
create trigger location_place_limit before insert or update on public.saved_places for each row execute function public.location_place_limit();

-- Do not broadcast old coordinate images on DELETE. Clients refetch on events.
alter table public.locations replica identity default;
do $$ declare t text; begin
  foreach t in array array['locations', 'journeys'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Delete associated journey destinations immediately when a point is removed.
create or replace function public.location_remove_journeys() returns trigger language plpgsql security invoker set search_path = '' as $$
begin delete from public.journeys where user_id = old.user_id; return old; end $$;
revoke all on function public.location_remove_journeys() from public, anon, authenticated;
drop trigger if exists location_remove_journeys on public.locations;
create trigger location_remove_journeys after delete on public.locations for each row execute function public.location_remove_journeys();

create extension if not exists pg_cron;
-- Physical deletion within one minute; RLS denies partner reads exactly at expiry.
select cron.schedule('location-expiry-cleanup', '* * * * *', $cron$
  delete from public.locations where sharing_until <= now();
  delete from public.journeys where status <> 'active' or not exists (select 1 from public.locations l where l.user_id = journeys.user_id and l.sharing_until > now());
$cron$);
commit;
