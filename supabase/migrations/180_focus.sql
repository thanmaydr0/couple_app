begin;
create table if not exists public.focus_sessions (
 id uuid primary key default gen_random_uuid(), couple_id uuid not null references public.couples(id),
 started_by uuid not null, started_at timestamptz not null default now(),
 work_sec int not null check(work_sec between 60 and 10800), break_sec int not null check(break_sec between 60 and 3600),
 cycles int not null check(cycles between 1 and 12), status text not null default 'active' check(status in ('active','finished','cancelled')),
 label text not null default '' check(length(label)<=80), unique(couple_id,id),
 foreign key(couple_id,started_by) references public.profiles(couple_id,id)
);
create unique index if not exists focus_one_active on public.focus_sessions(couple_id) where status='active';
create index if not exists focus_sessions_history on public.focus_sessions(couple_id,started_at desc);
create table if not exists public.focus_log (
 id uuid primary key default gen_random_uuid(), couple_id uuid not null references public.couples(id), user_id uuid not null,
 session_id uuid not null, completed_cycles int not null default 0 check(completed_cycles>=0), minutes int not null default 0 check(minutes>=0), day date not null,
 foreign key(couple_id,session_id) references public.focus_sessions(couple_id,id),
 foreign key(couple_id,user_id) references public.profiles(couple_id,id), unique(session_id,user_id,day)
);
create index if not exists focus_log_stats on public.focus_log(couple_id,day,user_id);
create table if not exists public.garden_plants (
 id uuid primary key, couple_id uuid not null references public.couples(id), species text not null check(species in ('daisy','tulip','pine','blossom')),
 grown_at timestamptz not null, session_id uuid not null, x real not null check(x between 0 and 1), y real not null check(y between 0 and 1),
 foreign key(couple_id,session_id) references public.focus_sessions(couple_id,id)
);
create index if not exists garden_couple_grown on public.garden_plants(couple_id,grown_at);
create index if not exists garden_session_grown on public.garden_plants(session_id,grown_at);
alter table public.focus_sessions enable row level security;
alter table public.focus_log enable row level security;
alter table public.garden_plants enable row level security;
drop policy if exists focus_read on public.focus_sessions;
create policy focus_read on public.focus_sessions for select to authenticated using(couple_id=(select public.my_couple_id()));
drop policy if exists focus_read on public.focus_log;
create policy focus_read on public.focus_log for select to authenticated using(couple_id=(select public.my_couple_id()));
drop policy if exists focus_read on public.garden_plants;
create policy focus_read on public.garden_plants for select to authenticated using(couple_id=(select public.my_couple_id()));
revoke all on public.focus_sessions,public.focus_log,public.garden_plants from anon,authenticated;
grant select on public.focus_sessions,public.focus_log,public.garden_plants to authenticated;
-- Only these validated RPCs may write timestamps, stats and rewards.
create or replace function public.focus_clock() returns timestamptz language sql volatile security invoker set search_path='' as $$ select clock_timestamp() $$;
create or replace function public.focus_sync(p_session uuid, p_end boolean default false)
returns public.focus_sessions language plpgsql security definer set search_path='' as $$
declare s public.focus_sessions; n int; i int; t timestamptz; uid uuid; cid uuid := public.my_couple_id();
begin
 if auth.uid() is null or cid is null then raise exception 'Not paired'; end if;
 select * into s from public.focus_sessions where id=p_session and couple_id=cid for update;
 if not found then raise exception 'Room unavailable'; end if;
 if s.status<>'active' then return s; end if;
 n := least(s.cycles,greatest(0,floor((extract(epoch from (clock_timestamp()-s.started_at))+s.break_sec)/(s.work_sec+s.break_sec))::int));
 for i in 1..n loop
  t := s.started_at + make_interval(secs => (i-1)*(s.work_sec+s.break_sec)+s.work_sec);
  insert into public.garden_plants(id,couple_id,species,grown_at,session_id,x,y)
   values(md5(s.id::text||':'||i)::uuid,cid,(array['daisy','tulip','pine','blossom'])[1+((i-1)%4)],t,s.id,
    (('x'||substr(md5(s.id::text||i),1,6))::bit(24)::int % 1000)/1000.0,
    (('x'||substr(md5(s.id::text||i),7,6))::bit(24)::int % 1000)/1000.0) on conflict(id) do nothing;
 end loop;
 for uid in select distinct user_id from public.focus_log where session_id=s.id loop
  insert into public.focus_log(couple_id,user_id,session_id,completed_cycles,minutes,day)
  select cid,uid,s.id,count(*)::int,(count(*)*s.work_sec/60)::int,(grown_at at time zone 'UTC')::date
   from public.garden_plants where session_id=s.id group by (grown_at at time zone 'UTC')::date
  on conflict(session_id,user_id,day) do update set completed_cycles=excluded.completed_cycles,minutes=excluded.minutes
   where public.focus_log.completed_cycles<>excluded.completed_cycles or public.focus_log.minutes<>excluded.minutes;
 end loop;
 if p_end or clock_timestamp() >= s.started_at + make_interval(secs=>s.cycles*s.work_sec+(s.cycles-1)*s.break_sec) then
  update public.focus_sessions set status=case when n=s.cycles then 'finished' else 'cancelled' end where id=s.id returning * into s;
 end if;
 return s;
end $$;
create or replace function public.focus_start(p_work int,p_break int,p_cycles int,p_label text)
returns public.focus_sessions language plpgsql security definer set search_path='' as $$
declare cid uuid:=public.my_couple_id(); s public.focus_sessions; old_id uuid;
begin
 if auth.uid() is null or cid is null then raise exception 'Not paired'; end if;
 perform pg_advisory_xact_lock(hashtextextended(cid::text,180));
 select id into old_id from public.focus_sessions where couple_id=cid and status='active';
 if old_id is not null then perform public.focus_sync(old_id); end if;
 if exists(select 1 from public.focus_sessions where couple_id=cid and status='active') then raise exception 'Your partner already started a room. Join it instead.'; end if;
 insert into public.focus_sessions(couple_id,started_by,work_sec,break_sec,cycles,label) values(cid,auth.uid(),p_work,p_break,p_cycles,trim(p_label)) returning * into s;
 insert into public.focus_log(couple_id,user_id,session_id,day) values(cid,auth.uid(),s.id,(s.started_at at time zone 'UTC')::date);
 return s;
end $$;
create or replace function public.focus_join(p_session uuid)
returns public.focus_sessions language plpgsql security definer set search_path='' as $$
declare s public.focus_sessions;
begin
 s:=public.focus_sync(p_session);
 if s.status<>'active' then raise exception 'This room has ended'; end if;
 insert into public.focus_log(couple_id,user_id,session_id,day) values(s.couple_id,auth.uid(),s.id,(s.started_at at time zone 'UTC')::date) on conflict do nothing;
 return s;
end $$;
revoke all on function public.focus_clock(),public.focus_sync(uuid,boolean),public.focus_start(int,int,int,text),public.focus_join(uuid) from public,anon;
grant execute on function public.focus_clock(),public.focus_sync(uuid,boolean),public.focus_start(int,int,int,text),public.focus_join(uuid) to authenticated;
drop policy if exists focus_room_read on realtime.messages;
create policy focus_room_read on realtime.messages for select to authenticated using(realtime.topic()='focus:'||(select public.my_couple_id())::text);
drop policy if exists focus_room_send on realtime.messages;
create policy focus_room_send on realtime.messages for insert to authenticated with check(realtime.topic()='focus:'||(select public.my_couple_id())::text);
do $$ declare t text; begin
 foreach t in array array['focus_sessions','focus_log','garden_plants'] loop
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t); end if;
 end loop;
end $$;
commit;
