-- Voice notes extend existing couple-scoped chat; no new public tables.
begin;
alter table public.messages add column if not exists meta jsonb;
alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check check(kind in ('text','image','system','voice'));
alter table public.messages enable row level security;
create index if not exists messages_voice_sequence_idx on public.messages(couple_id,created_at,id) where kind='voice';

create or replace function chat_private.guard_voice() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' then
  if new.kind='voice' then
   if new.media_path is null or new.media_path !~ ('^'||new.couple_id::text||'/chat/voice/[0-9a-f-]+\.m4a$') or new.view_once then
    raise exception 'Invalid voice path';
   end if;
   if new.meta is null or jsonb_typeof(new.meta)<>'object'
      or jsonb_typeof(new.meta->'duration_ms') is distinct from 'number'
      or jsonb_typeof(new.meta->'peaks') is distinct from 'array' then raise exception 'Invalid voice metadata'; end if;
   if (new.meta->>'duration_ms')::numeric not between 400 and 300000 or jsonb_array_length(new.meta->'peaks')<>64 then raise exception 'Invalid voice duration or waveform'; end if;
   if exists(select 1 from jsonb_array_elements(new.meta->'peaks') p where jsonb_typeof(p)<>'number') then raise exception 'Invalid waveform'; end if;
   if exists(select 1 from jsonb_array_elements(new.meta->'peaks') p where p::text::numeric not between 0 and 1) then raise exception 'Invalid waveform range'; end if;
   new.meta:=jsonb_build_object('duration_ms',new.meta->'duration_ms','peaks',new.meta->'peaks');
  elsif new.meta is not null then raise exception 'Metadata is reserved for voice'; end if;
 elsif new.meta is distinct from old.meta then
  if auth.uid() is null or new.couple_id is distinct from public.my_couple_id() or old.kind<>'voice'
     or old.sender_id=auth.uid() or old.deleted_at is not null or (old.expires_at is not null and old.expires_at<=now())
     or (new.meta-'played_at') is distinct from (old.meta-'played_at') or not (new.meta ? 'played_at') then raise exception 'Only recipient may mark voice heard'; end if;
  new.meta:=jsonb_set(old.meta,'{played_at}',coalesce(old.meta->'played_at',to_jsonb(now())));
 end if;
 return new;
end $$;
drop trigger if exists voice_message_guard on public.messages;
create trigger voice_message_guard before insert or update on public.messages for each row execute function chat_private.guard_voice();
grant update(meta) on public.messages to authenticated;
create or replace function public.voice_mark_played(message_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 update public.messages set meta=jsonb_set(meta,'{played_at}',to_jsonb(now()))
 where id=message_id and couple_id=public.my_couple_id() and sender_id<>auth.uid() and kind='voice'
 and deleted_at is null and (expires_at is null or expires_at>now()) returning meta into result;
 if result is null then raise exception 'Voice note unavailable'; end if;
 return result;
end $$;
revoke all on function public.voice_mark_played(uuid) from public,anon;
grant execute on function public.voice_mark_played(uuid) to authenticated;

-- Preserve the existing MIME allowlist; existing media RLS already scopes the
-- first path segment to my_couple_id(). Capsules already permit audio/mp4.
update storage.buckets set allowed_mime_types = case when allowed_mime_types is null then null
 else array(select distinct unnest(allowed_mime_types||array['audio/mp4','audio/m4a'])) end where id='media';
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then
  alter publication supabase_realtime add table public.messages;
 end if;
end $$;
commit;
