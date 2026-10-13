begin;
create table if not exists public.events (
 id uuid primary key default gen_random_uuid(), couple_id uuid not null references public.couples(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 160), starts_at timestamptz not null, ends_at timestamptz not null,
 all_day boolean not null default false, location text check(length(location)<=300), notes text check(length(notes)<=2000),
 kind text not null default 'custom' check(kind in ('date','meet','anniversary','birthday','reminder','custom')),
 status text not null default 'confirmed' check(status in ('confirmed','proposed','declined')),
 proposed_by uuid references public.profiles(id), repeat text not null default 'none' check(repeat in ('none','weekly','monthly','yearly')),
 remind_minutes int[] not null default '{60}' check(cardinality(remind_minutes)<=5 and 0<=all(remind_minutes) and 10080>=all(remind_minutes) and array_position(remind_minutes,null) is null),
 created_by uuid not null default auth.uid() references public.profiles(id), created_at timestamptz not null default now(),
 check(ends_at>starts_at), check(status<>'proposed' or proposed_by is not null),
 check(not all_day or (starts_at at time zone 'UTC')::time='00:00'::time and (ends_at at time zone 'UTC')::time='00:00'::time)
);
create table if not exists public.countdowns (
 id uuid primary key default gen_random_uuid(), couple_id uuid not null references public.couples(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 160), target_at timestamptz not null,
 emoji text not null default '♡' check(length(emoji)<=12), pinned boolean not null default false,
 created_by uuid not null default auth.uid() references public.profiles(id)
);
create table if not exists public.availability (
 user_id uuid not null references public.profiles(id) on delete cascade, couple_id uuid not null references public.couples(id) on delete cascade,
 weekday int not null check(weekday between 0 and 6), start_minute int not null check(start_minute between 0 and 1439),
 end_minute int not null check(end_minute between 1 and 1440), tz text not null,
 primary key(user_id,weekday,start_minute), check(end_minute>start_minute)
);
create index if not exists events_couple_time_idx on public.events(couple_id,starts_at);
create index if not exists events_creator_idx on public.events(created_by);
create index if not exists events_proposer_idx on public.events(proposed_by);
create index if not exists countdowns_couple_time_idx on public.countdowns(couple_id,target_at);
create index if not exists countdowns_creator_idx on public.countdowns(created_by);
create unique index if not exists countdowns_one_pin_idx on public.countdowns(couple_id) where pinned;
create index if not exists availability_couple_idx on public.availability(couple_id,user_id);
alter table public.events enable row level security;
alter table public.countdowns enable row level security;
alter table public.availability enable row level security;
revoke all on public.events,public.countdowns,public.availability from anon,authenticated;
grant select,insert,update,delete on public.events,public.countdowns,public.availability to authenticated;
grant all on public.events,public.countdowns,public.availability to service_role;
do $$ declare t text; begin foreach t in array array['events','countdowns'] loop
 execute format('drop policy if exists plans_read on public.%I',t);
 execute format('create policy plans_read on public.%I for select to authenticated using(couple_id=(select public.my_couple_id()))',t);
 execute format('drop policy if exists plans_insert on public.%I',t);
 execute format('create policy plans_insert on public.%I for insert to authenticated with check(couple_id=(select public.my_couple_id()) and created_by=(select auth.uid()))',t);
 execute format('drop policy if exists plans_update on public.%I',t);
 execute format('create policy plans_update on public.%I for update to authenticated using(couple_id=(select public.my_couple_id())) with check(couple_id=(select public.my_couple_id()))',t);
 execute format('drop policy if exists plans_delete on public.%I',t);
 execute format('create policy plans_delete on public.%I for delete to authenticated using(couple_id=(select public.my_couple_id()))',t);
 end loop; end $$;
drop policy if exists plans_read on public.availability;
create policy plans_read on public.availability for select to authenticated using(couple_id=(select public.my_couple_id()));
drop policy if exists plans_own on public.availability;
create policy plans_own on public.availability for all to authenticated using(couple_id=(select public.my_couple_id()) and user_id=(select auth.uid())) with check(couple_id=(select public.my_couple_id()) and user_id=(select auth.uid()));

create schema if not exists plans_private;
revoke all on schema plans_private from public,anon,authenticated;
-- No callable privileged API: these functions are only entered by table triggers
-- or a service-only continuation RPC, and recheck membership against the source.
create or replace function plans_private.guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.couple_id<>old.couple_id or new.created_by<>old.created_by or new.id<>old.id) then raise exception 'Immutable plan identity'; end if;
 if tg_table_name='events' then
  if new.proposed_by is not null and not exists(select 1 from public.profiles where id=new.proposed_by and couple_id=new.couple_id) then raise exception 'Invalid proposer'; end if;
  if auth.uid() is not null and new.status='proposed' and new.proposed_by<>auth.uid() then raise exception 'Invalid proposer'; end if;
  if tg_op='UPDATE' and old.status='proposed' and new.status in ('confirmed','declined') and old.proposed_by=auth.uid() then raise exception 'Only partner may respond'; end if;
 end if;
 if not exists(select 1 from public.profiles where id=new.created_by and couple_id=new.couple_id) then raise exception 'Invalid creator'; end if;
 return new;
end $$;
drop trigger if exists plans_guard on public.events;
create trigger plans_guard before insert or update on public.events for each row execute function plans_private.guard();
drop trigger if exists plans_guard on public.countdowns;
create trigger plans_guard before insert or update on public.countdowns for each row execute function plans_private.guard();

create or replace function plans_private.queue_reminder(e public.events, sender uuid, mins int, after_at timestamptz) returns void language plpgsql security definer set search_path='' as $$
declare z text; base timestamp; occurrence timestamptz; candidate timestamp; n int; step interval; version text;
begin
 if e.status<>'confirmed' then return; end if;
 select coalesce(p.timezone,'UTC') into z from public.profiles p where p.couple_id=e.couple_id and p.id<>sender limit 1;
 if z is null then return; end if;
 if not exists(select 1 from pg_timezone_names where name=z) then z:='UTC'; end if;
 if e.all_day then base:=(e.starts_at at time zone 'UTC')::date + time '09:00';
 else select coalesce(timezone,'UTC') into z from public.profiles where id=e.created_by and couple_id=e.couple_id;
  if z is null or not exists(select 1 from pg_timezone_names where name=z) then z:='UTC'; end if;
  base:=e.starts_at at time zone z;
 end if;
 version:=md5(to_jsonb(e)::text);
 step:=case e.repeat when 'weekly' then interval '7 days' when 'monthly' then interval '1 month' when 'yearly' then interval '1 year' else interval '0' end;
 for n in 0..12000 loop
  candidate:=base+n*step;
  occurrence:=case when n=0 and not e.all_day then e.starts_at else candidate at time zone z end;
  -- Omit ambiguous and nonexistent recurrence wall times, matching client expansion.
  if candidate<>(occurrence at time zone z) or ((occurrence-interval '1 hour') at time zone z)=candidate or ((occurrence+interval '1 hour') at time zone z)=candidate or ((occurrence-interval '30 minutes') at time zone z)=candidate or ((occurrence+interval '30 minutes') at time zone z)=candidate then
   if e.repeat='none' then return; end if; continue;
  end if;
  if occurrence-make_interval(mins=>mins)>after_at then
   if not exists(select 1 from public.scheduled_jobs j where j.couple_id=e.couple_id and j.kind='plan_reminder' and j.created_by=sender and j.run_at=occurrence-make_interval(mins=>mins) and j.payload->>'event_id'=e.id::text and j.payload->>'version'=version and j.status in ('pending','done')) then
    insert into public.scheduled_jobs(couple_id,kind,run_at,payload,created_by) values(e.couple_id,'plan_reminder',occurrence-make_interval(mins=>mins),jsonb_build_object('event_id',e.id,'version',version,'minutes',mins,'occurrence',occurrence),sender);
   end if; return;
  end if;
  if e.repeat='none' then return; end if;
 end loop;
end $$;
create or replace function plans_private.sync_event() returns trigger language plpgsql security definer set search_path='' as $$
declare e public.events; p record; m int;
begin
 if tg_op='DELETE' then e:=old; else e:=new; end if;
 if tg_op='UPDATE' and to_jsonb(old)=to_jsonb(new) then return new; end if;
 update public.scheduled_jobs set status='cancelled',locked_until=null where kind='plan_reminder' and couple_id=e.couple_id and payload->>'event_id'=e.id::text and status='pending';
 if tg_op='DELETE' then delete from public.countdowns where id=e.id and couple_id=e.couple_id; return old; end if;
 if e.status='confirmed' then
  for p in select id from public.profiles where couple_id=e.couple_id loop foreach m in array e.remind_minutes loop perform plans_private.queue_reminder(e,p.id,m,now()); end loop; end loop;
  if tg_op='UPDATE' and old.status='proposed' then
   insert into public.countdowns(id,couple_id,title,target_at,emoji,created_by) values(e.id,e.couple_id,e.title,e.starts_at,'♡',e.created_by) on conflict(id) do update set title=excluded.title,target_at=excluded.target_at;
  else update public.countdowns set title=e.title,target_at=e.starts_at where id=e.id and couple_id=e.couple_id; end if;
 else delete from public.countdowns where id=e.id and couple_id=e.couple_id;
 end if;
 return new;
end $$;
drop trigger if exists plans_sync_event on public.events;
create trigger plans_sync_event after insert or update or delete on public.events for each row execute function plans_private.sync_event();

create or replace function plans_private.sync_countdown() returns trigger language plpgsql security definer set search_path='' as $$
declare c public.countdowns; p record;
begin
 if tg_op='DELETE' then c:=old; else c:=new; end if;
 if tg_op='UPDATE' and old.target_at=new.target_at and old.title=new.title then return new; end if;
 update public.scheduled_jobs set status='cancelled',locked_until=null where kind='countdown' and couple_id=c.couple_id and payload->>'countdown_id'=c.id::text and status='pending';
 if tg_op<>'DELETE' and c.target_at>now() then
  for p in select id from public.profiles where couple_id=c.couple_id loop
   insert into public.scheduled_jobs(couple_id,kind,run_at,payload,created_by) values(c.couple_id,'countdown',c.target_at,jsonb_build_object('countdown_id',c.id,'target_at',c.target_at),p.id);
  end loop;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
drop trigger if exists plans_sync_countdown on public.countdowns;
create trigger plans_sync_countdown after insert or update or delete on public.countdowns for each row execute function plans_private.sync_countdown();

create or replace function public.plans_respond(event_id uuid,response text) returns void language plpgsql security invoker set search_path='' as $$
begin
 if response not in ('confirmed','declined') then raise exception 'Invalid response'; end if;
 update public.events set status=response,proposed_by=null where id=event_id and couple_id=public.my_couple_id() and status='proposed' and proposed_by<>auth.uid();
 if not found then raise exception 'Proposal unavailable or already answered'; end if;
end $$;
create or replace function public.plans_pin_countdown(countdown_id uuid,pin boolean) returns void language plpgsql security invoker set search_path='' as $$
declare cid uuid:=public.my_couple_id(); begin
 perform 1 from public.couples where id=cid for update;
 if not exists(select 1 from public.countdowns where id=countdown_id and couple_id=cid) then raise exception 'Countdown unavailable'; end if;
 if pin then update public.countdowns set pinned=false where couple_id=cid and pinned; end if;
 update public.countdowns set pinned=pin where id=countdown_id and couple_id=cid;
end $$;
create or replace function public.plans_save_availability(windows jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare cid uuid:=public.my_couple_id(); begin
 if auth.uid() is null or cid is null or jsonb_typeof(windows)<>'array' or jsonb_array_length(windows)>168 then raise exception 'Invalid windows'; end if;
 if exists(select 1 from jsonb_to_recordset(windows) as w(weekday int,start_minute int,end_minute int,tz text) where not exists(select 1 from pg_timezone_names where name=w.tz)) then raise exception 'Invalid timezone'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,150));
 delete from public.availability where user_id=auth.uid() and couple_id=cid;
 insert into public.availability(user_id,couple_id,weekday,start_minute,end_minute,tz) select auth.uid(),cid,w.weekday,w.start_minute,w.end_minute,w.tz from jsonb_to_recordset(windows) as w(weekday int,start_minute int,end_minute int,tz text);
end $$;
create or replace function public.plans_continue_reminder(job_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare j public.scheduled_jobs; e public.events;
begin
 select * into j from public.scheduled_jobs where id=job_id and kind='plan_reminder'; if not found then return; end if;
 select * into e from public.events where id=(j.payload->>'event_id')::uuid and couple_id=j.couple_id for update;
 if not found or md5(to_jsonb(e)::text)<>j.payload->>'version' then return; end if;
 perform plans_private.queue_reminder(e,j.created_by,(j.payload->>'minutes')::int,greatest(now(),j.run_at));
end $$;
create or replace function public.plans_reminder_valid(job_id uuid) returns boolean language sql security definer set search_path='' as $$
 select exists(select 1 from public.scheduled_jobs j join public.events e on e.id=(j.payload->>'event_id')::uuid and e.couple_id=j.couple_id
 where j.id=job_id and j.kind='plan_reminder' and j.status='pending' and j.run_at<=now() and e.status='confirmed' and md5(to_jsonb(e)::text)=j.payload->>'version'
 and (j.payload->>'minutes')::int=any(e.remind_minutes)
 and exists(select 1 from public.profiles p where p.id=j.created_by and p.couple_id=j.couple_id));
$$;
revoke all on function public.plans_reminder_valid(uuid) from public,anon,authenticated;
grant execute on function public.plans_reminder_valid(uuid) to service_role;
create or replace function plans_private.timezone_changed() returns trigger language plpgsql security definer set search_path='' as $$
declare e public.events; p record; m int; begin
 if new.timezone is not distinct from old.timezone then return new; end if;
 for e in select * from public.events where couple_id=new.couple_id and status='confirmed' for update loop
  update public.scheduled_jobs set status='cancelled',locked_until=null where kind='plan_reminder' and couple_id=e.couple_id and payload->>'event_id'=e.id::text and status='pending';
  for p in select id from public.profiles where couple_id=e.couple_id loop foreach m in array e.remind_minutes loop perform plans_private.queue_reminder(e,p.id,m,now()); end loop; end loop;
 end loop;
 return new;
end $$;
drop trigger if exists plans_timezone_changed on public.profiles;
create trigger plans_timezone_changed after update of timezone on public.profiles for each row execute function plans_private.timezone_changed();
revoke all on all functions in schema plans_private from public,anon,authenticated;
revoke all on function public.plans_continue_reminder(uuid) from public,anon,authenticated;
grant execute on function public.plans_continue_reminder(uuid) to service_role;
revoke all on function public.plans_respond(uuid,text),public.plans_pin_countdown(uuid,boolean),public.plans_save_availability(jsonb) from public,anon;
grant execute on function public.plans_respond(uuid,text),public.plans_pin_countdown(uuid,boolean),public.plans_save_availability(jsonb) to authenticated;
do $$ declare t text; begin foreach t in array array['events','countdowns','availability'] loop
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t); end if;
end loop; end $$;
commit;
