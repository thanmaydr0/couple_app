-- Pulse owns only its tables, helper schema and topic policies.
create table if not exists public.pulse_answers (
 id uuid primary key default gen_random_uuid(), couple_id uuid not null references public.couples(id) on delete cascade,
 day date not null, user_id uuid not null references public.profiles(id) on delete cascade,
 answer text not null check (char_length(btrim(answer)) between 1 and 2000), created_at timestamptz not null default now(),
 unique(couple_id, day, user_id)
);
create table if not exists public.pulse_status (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 couple_id uuid not null references public.couples(id) on delete cascade,
 mood text not null default 'calm' check (mood in ('joyful','calm','loved','hopeful','tired','anxious','sad','overwhelmed')),
 availability text not null default 'free' check (availability in ('free','busy','sleeping','driving','studying','working')),
 note text check (char_length(note) <= 240), updated_at timestamptz not null default now()
);
create table if not exists public.pulse_heartbeats (
 id uuid primary key default gen_random_uuid(), couple_id uuid not null references public.couples(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade, day date not null, created_at timestamptz not null default now()
);
create index if not exists pulse_answers_history on public.pulse_answers(couple_id,day desc);
create index if not exists pulse_status_couple on public.pulse_status(couple_id);
create index if not exists pulse_heartbeats_day on public.pulse_heartbeats(couple_id,day);
alter table public.pulse_answers enable row level security;
alter table public.pulse_status enable row level security;
alter table public.pulse_heartbeats enable row level security;
create schema if not exists pulse_private;
revoke all on schema pulse_private from public;
grant usage on schema pulse_private to authenticated;
-- Intentionally definer: avoid recursive SELECT policy; return only caller's boolean.
create or replace function pulse_private.answered(target_day date) returns boolean
language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and exists(select 1 from public.pulse_answers
 where couple_id = public.my_couple_id() and user_id = auth.uid() and day = target_day);
$$;
create or replace function pulse_private.today() returns date
language sql stable security invoker set search_path = '' as $$
 select (now() at time zone coalesce((select timezone from public.couples where id = public.my_couple_id()),'Asia/Kolkata'))::date;
$$;
revoke all on function pulse_private.answered(date), pulse_private.today() from public;
grant execute on function pulse_private.answered(date), pulse_private.today() to authenticated;
drop policy if exists pulse_answers_read on public.pulse_answers;
create policy pulse_answers_read on public.pulse_answers for select to authenticated using (
 couple_id = (select public.my_couple_id()) and
 (user_id = (select auth.uid()) or day < pulse_private.today() or pulse_private.answered(day))
);
-- Immutable answers prevent answering, reading a partner answer, then un-answering.
drop policy if exists pulse_answers_write on public.pulse_answers;
create policy pulse_answers_write on public.pulse_answers for insert to authenticated with check (
 couple_id = (select public.my_couple_id()) and user_id = (select auth.uid()) and day = pulse_private.today()
);
drop policy if exists pulse_status_read on public.pulse_status;
create policy pulse_status_read on public.pulse_status for select to authenticated using (couple_id = (select public.my_couple_id()));
drop policy if exists pulse_status_insert on public.pulse_status;
create policy pulse_status_insert on public.pulse_status for insert to authenticated with check (couple_id = (select public.my_couple_id()) and user_id = (select auth.uid()));
drop policy if exists pulse_status_update on public.pulse_status;
create policy pulse_status_update on public.pulse_status for update to authenticated using (couple_id = (select public.my_couple_id()) and user_id = (select auth.uid())) with check (couple_id = (select public.my_couple_id()) and user_id = (select auth.uid()));
create or replace function pulse_private.stamp() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists pulse_status_stamp on public.pulse_status;
create trigger pulse_status_stamp before update on public.pulse_status for each row execute function pulse_private.stamp();
drop policy if exists pulse_heartbeats_read on public.pulse_heartbeats;
create policy pulse_heartbeats_read on public.pulse_heartbeats for select to authenticated using (couple_id = (select public.my_couple_id()));
drop policy if exists pulse_heartbeats_write on public.pulse_heartbeats;
create policy pulse_heartbeats_write on public.pulse_heartbeats for insert to authenticated with check (couple_id = (select public.my_couple_id()) and user_id = (select auth.uid()) and day = pulse_private.today());
revoke all on public.pulse_answers,public.pulse_status,public.pulse_heartbeats from anon,authenticated;
grant select,insert on public.pulse_answers,public.pulse_heartbeats to authenticated;
grant select,insert,update on public.pulse_status to authenticated;
drop policy if exists pulse_topic_read on realtime.messages;
create policy pulse_topic_read on realtime.messages for select to authenticated using (extension in ('broadcast','presence') and (select realtime.topic()) = 'pulse:' || (select public.my_couple_id())::text);
drop policy if exists pulse_topic_write on realtime.messages;
create policy pulse_topic_write on realtime.messages for insert to authenticated with check (extension in ('broadcast','presence') and (select realtime.topic()) = 'pulse:' || (select public.my_couple_id())::text);
do $$ declare t text; begin foreach t in array array['pulse_answers','pulse_status','pulse_heartbeats'] loop
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t); end if;
end loop; end $$;
-- RLS examples (use two linked test users A/B plus outsider C; wrap in rollback):
-- set local role authenticated;
-- select set_config('request.jwt.claim.sub', '<B uuid>', true);
-- insert into pulse_answers(couple_id,day,user_id,answer) values ('<couple>',pulse_private.today(),auth.uid(),'B secret');
-- select set_config('request.jwt.claim.sub', '<A uuid>', true);
-- select * from pulse_answers where day=pulse_private.today(); -- 0 rows
-- insert into pulse_answers(couple_id,day,user_id,answer) values ('<couple>',pulse_private.today(),auth.uid(),'A secret');
-- select * from pulse_answers where day=pulse_private.today(); -- 2 rows
-- select set_config('request.jwt.claim.sub', '<C uuid>', true);
-- select * from pulse_answers where couple_id='<couple>'; -- 0 rows, including past
