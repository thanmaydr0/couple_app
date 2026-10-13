begin;
create table if not exists public.yt_sessions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  host_id uuid not null references public.profiles(id),
  status text not null default 'active' check (status in ('active','ended')),
  current_video_id text check (current_video_id is null or current_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  queue jsonb not null default '[]'::jsonb check (jsonb_typeof(queue)='array' and jsonb_array_length(queue)<=50),
  created_at timestamptz not null default now()
);
create index if not exists yt_sessions_couple_created_idx on public.yt_sessions(couple_id, created_at desc);
create index if not exists yt_sessions_host_idx on public.yt_sessions(host_id);
create unique index if not exists yt_sessions_one_active_idx on public.yt_sessions(couple_id) where status='active';
alter table public.yt_sessions enable row level security;
grant select, insert, update, delete on public.yt_sessions to authenticated;
drop policy if exists yt_read on public.yt_sessions;
create policy yt_read on public.yt_sessions for select to authenticated using(couple_id=(select public.my_couple_id()));
drop policy if exists yt_insert on public.yt_sessions;
create policy yt_insert on public.yt_sessions for insert to authenticated with check(couple_id=(select public.my_couple_id()) and host_id=(select auth.uid()));
drop policy if exists yt_update on public.yt_sessions;
create policy yt_update on public.yt_sessions for update to authenticated using(couple_id=(select public.my_couple_id())) with check(couple_id=(select public.my_couple_id()) and exists(select 1 from public.profiles p where p.id=host_id and p.couple_id=yt_sessions.couple_id));
drop policy if exists yt_delete on public.yt_sessions;
create policy yt_delete on public.yt_sessions for delete to authenticated using(couple_id=(select public.my_couple_id()));
drop policy if exists yt_room_read on realtime.messages;
create policy yt_room_read on realtime.messages for select to authenticated using(extension in ('broadcast','presence') and exists(select 1 from public.yt_sessions s where 'yt:'||s.id::text=(select realtime.topic()) and s.couple_id=(select public.my_couple_id()) and s.status='active'));
drop policy if exists yt_room_write on realtime.messages;
create policy yt_room_write on realtime.messages for insert to authenticated with check(extension in ('broadcast','presence') and exists(select 1 from public.yt_sessions s where 'yt:'||s.id::text=(select realtime.topic()) and s.couple_id=(select public.my_couple_id()) and s.status='active'));
do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='yt_sessions') then
    alter publication supabase_realtime add table public.yt_sessions;
  end if;
end $$;
commit;
