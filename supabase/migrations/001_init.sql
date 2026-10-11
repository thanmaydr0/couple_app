-- Run as postgres in the Supabase SQL Editor. Safe to rerun on this schema.
begin;

create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  anniversary date,
  created_at timestamptz not null default now()
);
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  couple_id uuid references public.couples(id),
  display_name text,
  avatar_path text,
  last_seen timestamptz,
  created_at timestamptz not null default now(),
  unique (couple_id, id)
);
create index if not exists profiles_couple_id_idx on public.profiles(couple_id);
create table if not exists public.push_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token text not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id),
  sender_id uuid not null,
  kind text not null check (kind in ('text', 'image', 'system')),
  body text,
  media_path text,
  reply_to uuid,
  client_id text not null unique,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (couple_id, id),
  foreign key (couple_id, sender_id) references public.profiles(couple_id, id),
  foreign key (couple_id, reply_to) references public.messages(couple_id, id)
);
create index if not exists messages_couple_created_idx on public.messages(couple_id, created_at);
create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id),
  uploader_id uuid not null,
  kind text not null check (kind in ('photo', 'video')),
  storage_path text not null,
  thumb_path text,
  taken_at timestamptz not null,
  width int check (width > 0),
  height int check (height > 0),
  duration_ms int check (duration_ms >= 0),
  size_bytes bigint check (size_bytes >= 0),
  caption text,
  created_at timestamptz not null default now(),
  foreign key (couple_id, uploader_id) references public.profiles(couple_id, id),
  check (split_part(storage_path, '/', 1) = couple_id::text),
  check (thumb_path is null or split_part(thumb_path, '/', 1) = couple_id::text)
);
create index if not exists media_couple_taken_idx on public.media(couple_id, taken_at desc);
create table if not exists public.chess_games (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id),
  white_id uuid not null,
  black_id uuid not null,
  fen text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  pgn text not null default '',
  turn text not null default 'w' check (turn in ('w', 'b')),
  status text not null default 'active' check (status in ('active', 'checkmate', 'stalemate', 'draw', 'resigned')),
  winner_id uuid,
  draw_offered_by uuid,
  last_move_from text,
  last_move_to text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (couple_id, white_id) references public.profiles(couple_id, id),
  foreign key (couple_id, black_id) references public.profiles(couple_id, id),
  check (white_id <> black_id),
  check (winner_id is null or winner_id in (white_id, black_id)),
  check (draw_offered_by is null or draw_offered_by in (white_id, black_id))
);
create table if not exists public.scribble_matches (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id),
  created_by uuid not null,
  scores jsonb not null default '{}'::jsonb check (jsonb_typeof(scores) = 'object'),
  rounds_played int not null default 0 check (rounds_played >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (couple_id, created_by) references public.profiles(couple_id, id)
);
create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id),
  caller_id uuid not null,
  kind text not null check (kind in ('audio', 'video')),
  status text not null default 'ringing' check (status in ('ringing', 'answered', 'declined', 'missed', 'ended')),
  started_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz,
  foreign key (couple_id, caller_id) references public.profiles(couple_id, id)
);
create table if not exists public.watch_sessions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id),
  host_id uuid not null,
  title text,
  file_size bigint check (file_size >= 0),
  duration_ms int check (duration_ms >= 0),
  status text not null default 'open' check (status in ('open', 'active', 'ended')),
  created_at timestamptz not null default now(),
  foreign key (couple_id, host_id) references public.profiles(couple_id, id)
);

-- Required public helper: reveals ONLY the caller's membership and avoids
-- recursive profile RLS. No caller-supplied IDs or user_metadata are trusted.
create or replace function public.my_couple_id()
returns uuid language sql stable security definer set search_path = public
as $$ select couple_id from public.profiles where id = auth.uid() $$;
revoke all on function public.my_couple_id() from public, anon;
grant execute on function public.my_couple_id() to authenticated, service_role;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, split_part(new.email, '@', 1)) on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles(id, display_name)
select id, split_part(email, '@', 1) from auth.users
where not exists (select 1 from public.profiles p where p.id = auth.users.id)
on conflict (id) do nothing;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end; $$;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

-- RLS is combined with explicit table/column privileges. In particular an
-- own-profile UPDATE policy alone would permit changing couple_id!
do $$
declare t text;
begin
  foreach t in array array['couples','profiles','push_tokens','messages','media',
    'chess_games','scribble_matches','calls','watch_sessions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
  foreach t in array array['media','chess_games','scribble_matches','calls','watch_sessions'] loop
    execute format('create index if not exists %I on public.%I(couple_id)', t || '_couple_idx', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists couple_access on public.%I', t);
    execute format('create policy couple_access on public.%I for all to authenticated using (couple_id = (select public.my_couple_id())) with check (couple_id = (select public.my_couple_id()))', t);
  end loop;
  foreach t in array array['push_tokens','chess_games','scribble_matches'] loop
    execute format('drop trigger if exists touch_updated_at on public.%I', t);
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()', t);
  end loop;
end;
$$;

grant select on public.couples to authenticated;
drop policy if exists couples_select on public.couples;
create policy couples_select on public.couples for select to authenticated
using (id = (select public.my_couple_id()));

grant select on public.profiles to authenticated;
grant update(display_name, avatar_path, last_seen) on public.profiles to authenticated;
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
using (id = (select auth.uid()) or couple_id = (select public.my_couple_id()));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

grant select, insert, update, delete on public.push_tokens to authenticated;
drop policy if exists push_tokens_owner on public.push_tokens;
create policy push_tokens_owner on public.push_tokens for all to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, delete on public.messages to authenticated;
grant update(read_at) on public.messages to authenticated;
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages for select to authenticated
using (couple_id = (select public.my_couple_id()));
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated
with check (couple_id = (select public.my_couple_id()) and sender_id = (select auth.uid()) and read_at is null);
drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages for update to authenticated
using (couple_id = (select public.my_couple_id()) and sender_id <> (select auth.uid()))
with check (couple_id = (select public.my_couple_id()) and sender_id <> (select auth.uid()));
drop policy if exists messages_delete on public.messages;
create policy messages_delete on public.messages for delete to authenticated
using (couple_id = (select public.my_couple_id()));

-- Publication already exists on hosted Supabase. Only suppress duplicate
-- membership, so other deployment errors remain visible.
do $$
declare t text;
begin
  foreach t in array array['messages','media','chess_games','scribble_matches',
    'calls','watch_sessions','profiles'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end;
$$;
commit;
