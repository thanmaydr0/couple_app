begin;
create table if not exists public.places (
 id uuid primary key default gen_random_uuid(),
 couple_id uuid not null references public.couples(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 160),
 country_code text check(country_code is null or country_code ~ '^[A-Z]{2}$'),
 lat double precision not null check(lat between -90 and 90),
 lon double precision not null check(lon between -180 and 180),
 kind text not null check(kind in ('visited','wishlist','home','special')),
 visited_on date, notes text check(length(notes)<=2000),
 media_ids uuid[] not null default '{}' check(cardinality(media_ids)<=30 and array_position(media_ids,null) is null),
 created_by uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now()
);
create index if not exists places_couple_date_idx on public.places(couple_id,visited_on desc,created_at desc);
create index if not exists places_couple_country_idx on public.places(couple_id,country_code);
create index if not exists places_created_by_idx on public.places(created_by);
alter table public.places enable row level security;
revoke all on public.places from anon,authenticated;
grant select,delete on public.places to authenticated;
grant insert(id,couple_id,name,country_code,lat,lon,kind,visited_on,notes,media_ids,created_by) on public.places to authenticated;
grant update(name,country_code,lat,lon,kind,visited_on,notes,media_ids) on public.places to authenticated;
grant all on public.places to service_role;
drop policy if exists places_select on public.places;
create policy places_select on public.places for select to authenticated using(couple_id=(select public.my_couple_id()));
drop policy if exists places_insert on public.places;
create policy places_insert on public.places for insert to authenticated with check(couple_id=(select public.my_couple_id()) and created_by=(select auth.uid()));
drop policy if exists places_update on public.places;
create policy places_update on public.places for update to authenticated using(couple_id=(select public.my_couple_id())) with check(couple_id=(select public.my_couple_id()));
drop policy if exists places_delete on public.places;
create policy places_delete on public.places for delete to authenticated using(couple_id=(select public.my_couple_id()));
-- Validate linked Memories under the caller's RLS, including on edits.
create or replace function public.places_check_media() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from unnest(new.media_ids) m(id) where not exists(select 1 from public.media where id=m.id and couple_id=new.couple_id and kind='photo')) then
  raise exception 'Linked photos must belong to this couple';
 end if;
 return new;
end $$;
revoke all on function public.places_check_media() from public,anon,authenticated;
drop trigger if exists places_check_media on public.places;
create trigger places_check_media before insert or update on public.places for each row execute function public.places_check_media();
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='places') then
  alter publication supabase_realtime add table public.places;
 end if;
end $$;
commit;
