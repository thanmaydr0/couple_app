-- Requires 001,100,200,300,330. Encryption remains OFF until the device ceremony.
begin;
alter table public.couples add column if not exists e2ee_enabled boolean not null default false;
alter table public.messages add column if not exists enc jsonb;
alter table public.message_reactions add column if not exists enc jsonb;
create table if not exists public.user_keys (
 user_id uuid primary key references auth.users(id) on delete cascade,
 couple_id uuid not null references public.couples(id) on delete cascade,
 public_key text not null check(public_key ~ '^[A-Za-z0-9+/]{43}=$'),
 key_version integer not null default 1 check(key_version>0),
 created_at timestamptz not null default now(),
 foreign key(couple_id,user_id) references public.profiles(couple_id,id)
);
create table if not exists public.key_backups (
 user_id uuid primary key references auth.users(id) on delete cascade,
 couple_id uuid not null references public.couples(id) on delete cascade,
 blob jsonb not null check(jsonb_typeof(blob)='object' and octet_length(blob::text)<4096),
 salt text not null check(salt ~ '^[A-Za-z0-9+/]{43}=$'),
 params jsonb not null, created_at timestamptz not null default now(),
 foreign key(couple_id,user_id) references public.profiles(couple_id,id)
);
create index if not exists user_keys_couple_idx on public.user_keys(couple_id);
create index if not exists key_backups_couple_idx on public.key_backups(couple_id);
create index if not exists messages_e2ee_legacy_idx on public.messages(couple_id,sender_id,id) where enc is null;
alter table public.user_keys enable row level security;
alter table public.key_backups enable row level security;
revoke all on public.user_keys,public.key_backups from public,anon,authenticated;
grant select on public.user_keys,public.key_backups to authenticated;
grant all on public.user_keys,public.key_backups to service_role;
drop policy if exists e2ee_keys_read on public.user_keys;
create policy e2ee_keys_read on public.user_keys for select to authenticated using(couple_id=(select public.my_couple_id()));
drop policy if exists e2ee_backup_read on public.key_backups;
create policy e2ee_backup_read on public.key_backups for select to authenticated using(couple_id=(select public.my_couple_id()) and user_id=(select auth.uid()));
-- Writes deliberately use one authenticated RPC; key and backup cannot diverge.
create or replace function public.e2ee_register(public_key text, backup_blob jsonb, backup_salt text, backup_params jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); cid uuid:=public.my_couple_id();
begin
 if actor is null or cid is null then raise exception 'Couple membership required'; end if;
 perform 1 from public.couples where id=cid for update;
 if public_key !~ '^[A-Za-z0-9+/]{43}=$' or backup_salt !~ '^[A-Za-z0-9+/]{43}=$'
 or backup_params is distinct from '{"N":32768,"r":8,"p":1,"dkLen":32}'::jsonb
 or jsonb_typeof(backup_blob) is distinct from 'object' or backup_blob->>'nonce' !~ '^[A-Za-z0-9+/]{32}$'
 or backup_blob->>'ciphertext' is null then raise exception 'Invalid recovery backup'; end if;
 insert into public.user_keys(user_id,couple_id,public_key) values(actor,cid,public_key)
 on conflict(user_id) do update set public_key=excluded.public_key,couple_id=excluded.couple_id,key_version=public.user_keys.key_version+1,created_at=now();
 insert into public.key_backups(user_id,couple_id,blob,salt,params) values(actor,cid,backup_blob,backup_salt,backup_params)
 on conflict(user_id) do update set couple_id=excluded.couple_id,blob=excluded.blob,salt=excluded.salt,params=excluded.params,created_at=now();
end $$;
create or replace function public.e2ee_set_enabled(enabled boolean) returns void language plpgsql security definer set search_path='' as $$
declare cid uuid:=public.my_couple_id();
begin
 if auth.uid() is null or cid is null or enabled is null then raise exception 'Couple membership required'; end if;
 perform 1 from public.couples where id=cid for update;
 if enabled then
  if (select count(*) from public.profiles where couple_id=cid)<>2 or (select count(*) from public.user_keys k join public.key_backups b using(user_id,couple_id) where k.couple_id=cid)<>2 then raise exception 'Both updated phones must register recovery-backed keys first'; end if;
  if exists(select 1 from public.scheduled_jobs where couple_id=cid and kind='scheduled_message' and status in('pending','failed') and payload->'enc' is null) then raise exception 'Cancel pending plaintext schedules before enabling encryption'; end if;
 end if;
 update public.couples set e2ee_enabled=enabled where id=cid;
end $$;
-- Prevent direct flag changes via broad existing UPDATE grants.
create or replace function chat_private.e2ee_flag_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.e2ee_enabled is distinct from old.e2ee_enabled and current_user='authenticated' then raise exception 'Use the encryption ceremony'; end if;
 return new;
end $$;
drop trigger if exists e2ee_flag_guard on public.couples;
create trigger e2ee_flag_guard before update on public.couples for each row execute function chat_private.e2ee_flag_guard();

create or replace function chat_private.valid_envelope(value jsonb) returns boolean language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(value)='object' and value->>'v'='1'
 and value->>'nonce' ~ '^[A-Za-z0-9+/]{32}$'
 and value->>'senderKey' ~ '^[A-Za-z0-9+/]{43}=$'
 and value->>'recipientKey' ~ '^[A-Za-z0-9+/]{43}=$'
 and value->>'ciphertext' ~ '^[A-Za-z0-9+/]+={0,2}$'
 and length(value->>'ciphertext') between 24 and 100000, false)
$$;
-- This validator runs as invoker; grant only EXECUTE, no schema CREATE.
grant usage on schema chat_private to authenticated,service_role;
revoke all on function chat_private.valid_envelope(jsonb) from public,anon;
grant execute on function chat_private.valid_envelope(jsonb) to authenticated,service_role;
grant update(enc) on public.messages to authenticated;

create or replace function chat_private.e2ee_message_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare enabled boolean;
begin
 select e2ee_enabled into enabled from public.couples where id=new.couple_id;
 if tg_op='INSERT' and enabled and new.kind<>'system' and new.enc is null then raise exception 'Update this phone: encrypted chat rejects plaintext messages'; end if;
 if tg_op='UPDATE' and enabled and new.kind<>'system' and new.enc is null and new.deleted_at is null and new.body is distinct from old.body then raise exception 'Update this phone: encrypt edited text'; end if;
 if new.enc is not null then
  if not chat_private.valid_envelope(new.enc) or new.body is not null or new.meta is not null then raise exception 'Encrypted rows cannot contain plaintext content'; end if;
  if tg_op='INSERT' or new.enc is distinct from old.enc then
   if new.enc->>'senderKey' is distinct from (select public_key from public.user_keys where user_id=new.sender_id and couple_id=new.couple_id)
    or not exists(select 1 from public.user_keys where user_id<>new.sender_id and couple_id=new.couple_id and public_key=new.enc->>'recipientKey') then raise exception 'Keys changed; refresh encryption status'; end if;
  end if;
 end if;
 if tg_op='UPDATE' and old.enc is not null and new.enc is null and new.deleted_at is null then raise exception 'Encrypted messages cannot be downgraded'; end if;
 return new;
end $$;
drop trigger if exists zz_e2ee_message_guard on public.messages;
create trigger zz_e2ee_message_guard before insert or update on public.messages for each row execute function chat_private.e2ee_message_guard();
create or replace function chat_private.e2ee_reaction_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if (select e2ee_enabled from public.couples where id=new.couple_id) and new.enc is null then raise exception 'Update this phone: encrypt reactions'; end if;
 if new.enc is not null and (new.emoji<>'🔒' or not chat_private.valid_envelope(new.enc)
 or new.enc->>'senderKey' is distinct from (select public_key from public.user_keys where user_id=new.user_id and couple_id=new.couple_id)
 or not exists(select 1 from public.user_keys where user_id<>new.user_id and couple_id=new.couple_id and public_key=new.enc->>'recipientKey')) then raise exception 'Invalid encrypted reaction'; end if;
 return new;
end $$;
drop trigger if exists e2ee_reaction_guard on public.message_reactions;
create trigger e2ee_reaction_guard before insert or update on public.message_reactions for each row execute function chat_private.e2ee_reaction_guard();

create or replace function public.e2ee_reencrypt(message_id uuid, encrypted jsonb, new_path text) returns void language plpgsql security definer set search_path='' as $$
declare cid uuid:=public.my_couple_id(); m public.messages;
begin
 if auth.uid() is null or cid is null then raise exception 'Authentication required'; end if;
 select * into m from public.messages where id=message_id and couple_id=cid and sender_id=auth.uid() for update;
 if not found or m.enc is not null or m.deleted_at is not null or m.kind='system' or m.view_once or (m.expires_at is not null and m.expires_at<=now()) then raise exception 'Legacy authored message unavailable'; end if;
 if not (select e2ee_enabled from public.couples where id=cid) or not chat_private.valid_envelope(encrypted) then raise exception 'Encryption required'; end if;
 if (m.media_path is null and new_path is not null) or (m.media_path is not null and (new_path is null or new_path not like cid::text||'/chat/%')) then raise exception 'Invalid encrypted attachment path'; end if;
 update public.messages set body=null,meta=null,enc=encrypted,media_path=new_path where id=m.id;
end $$;

create or replace function public.e2ee_save_schedule(job_id uuid,due timestamptz,encrypted jsonb,reply uuid default null,editing boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare cid uuid:=public.my_couple_id(); j public.scheduled_jobs;
begin
 if auth.uid() is null or cid is null or due<=now() or not chat_private.valid_envelope(encrypted) then raise exception 'Invalid encrypted schedule'; end if;
 perform 1 from public.couples where id=cid for update;
 if encrypted->>'senderKey' is distinct from (select public_key from public.user_keys where user_id=auth.uid() and couple_id=cid)
 or not exists(select 1 from public.user_keys where user_id<>auth.uid() and couple_id=cid and public_key=encrypted->>'recipientKey') then raise exception 'Keys changed'; end if;
 if editing then
  select * into j from public.scheduled_jobs where id=job_id and couple_id=cid and created_by=auth.uid() and kind='scheduled_message' for update;
  if not found or j.status<>'pending' or j.locked_until is not null or exists(select 1 from public.messages where client_id='scheduled:'||j.id::text) then raise exception 'Schedule unavailable'; end if;
  update public.scheduled_jobs set run_at=due,payload=jsonb_build_object('enc',encrypted,'reply_to',reply) where id=j.id;
 else
  insert into public.scheduled_jobs(id,couple_id,created_by,kind,run_at,payload) values(job_id,cid,auth.uid(),'scheduled_message',due,jsonb_build_object('enc',encrypted,'reply_to',reply));
 end if;
end $$;

-- Block old clients bypassing encryption via the job queue or old edit RPC.
create or replace function chat_private.e2ee_job_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.kind='scheduled_message' and new.status='pending' and (select e2ee_enabled from public.couples where id=new.couple_id) then
  if not chat_private.valid_envelope(new.payload->'enc') or new.payload ? 'body' or new.payload ? 'phrases' then raise exception 'Encrypt scheduled messages on an updated phone'; end if;
 end if;
 return new;
end $$;
drop trigger if exists e2ee_job_guard on public.scheduled_jobs;
create trigger e2ee_job_guard before insert or update on public.scheduled_jobs for each row execute function chat_private.e2ee_job_guard();

revoke all on function public.e2ee_register(text,jsonb,text,jsonb),public.e2ee_set_enabled(boolean),public.e2ee_reencrypt(uuid,jsonb,text),public.e2ee_save_schedule(uuid,timestamptz,jsonb,uuid,boolean) from public,anon;
grant execute on function public.e2ee_register(text,jsonb,text,jsonb),public.e2ee_set_enabled(boolean),public.e2ee_reencrypt(uuid,jsonb,text),public.e2ee_save_schedule(uuid,timestamptz,jsonb,uuid,boolean) to authenticated;
update storage.buckets set allowed_mime_types=case when allowed_mime_types is null then null else array(select distinct unnest(allowed_mime_types||array['application/octet-stream'])) end where id in('media','chat-once','capsules');
-- Capsules keep the encrypted envelope in their existing body text column.
create or replace function chat_private.e2ee_capsule_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare wire jsonb; enabled boolean;
begin
 select e2ee_enabled into enabled from public.couples where id=new.couple_id;
 if tg_op='UPDATE' and new.title is not distinct from old.title and new.body is not distinct from old.body and new.media_paths is not distinct from old.media_paths and new.voice_path is not distinct from old.voice_path then return new; end if;
 if enabled and new.body not like 'us:e2ee:v1:%' then raise exception 'Encrypt capsules on an updated phone'; end if;
 if tg_op='UPDATE' and old.body like 'us:e2ee:v1:%' and new.body not like 'us:e2ee:v1:%' then raise exception 'Cannot downgrade encrypted capsules'; end if;
 if new.body like 'us:e2ee:v1:%' then
  wire:=substring(new.body from 12)::jsonb;
  if new.title<>'Encrypted capsule' or not chat_private.valid_envelope(wire)
   or wire->>'senderKey' is distinct from (select public_key from public.user_keys where user_id=new.author_id and couple_id=new.couple_id)
   or not exists(select 1 from public.user_keys where user_id<>new.author_id and couple_id=new.couple_id and public_key=wire->>'recipientKey') then raise exception 'Invalid encrypted capsule'; end if;
 end if;
 return new;
end $$;
drop trigger if exists e2ee_capsule_guard on public.capsules;
create trigger e2ee_capsule_guard before insert or update on public.capsules for each row execute function chat_private.e2ee_capsule_guard();
do $$ declare t text; begin
 foreach t in array array['user_keys','couples'] loop
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t); end if;
 end loop;
end $$;
-- Existing guard/dispatch definitions adapted below, preserving legacy behavior.

create or replace function chat_private.guard_message() returns trigger language plpgsql security invoker set search_path='' as $$
declare ttl int; actor uuid:=auth.uid();
begin
 if tg_op='INSERT' then
  if actor is not null then
   if new.sender_id<>actor or new.couple_id is distinct from public.my_couple_id() or (new.kind='system' and current_user='authenticated') then raise exception 'Invalid message author'; end if;
   new.created_at:=now(); new.read_at:=null; new.edited_at:=null; new.deleted_at:=null; new.pinned_at:=null; new.pinned_by:=null; new.viewed_at:=null;
  end if;
  if new.view_once and (new.kind<>'image' or new.media_path not like new.couple_id::text||'/chat-once/'||new.sender_id::text||'/%') then raise exception 'Invalid view-once photo'; end if;
  if new.kind='image' and new.media_path is null then raise exception 'Photo path required'; end if;
  if new.kind='text' and ((new.enc is null and (new.body is null or length(trim(new.body)) not between 1 and 4000))) then raise exception 'Invalid message body'; end if;
  select disappearing_seconds into ttl from public.chat_settings where couple_id=new.couple_id;
  new.expires_at:=case when coalesce(ttl,0)>0 and new.kind<>'system' then now()+make_interval(secs=>ttl) else null end;
  return new;
 end if;
 if actor is null or current_user<>'authenticated' then return new; end if;
 if new.couple_id is distinct from old.couple_id or new.sender_id<>old.sender_id or new.id<>old.id or new.client_id<>old.client_id or new.created_at<>old.created_at or new.kind<>old.kind or new.media_path is distinct from old.media_path or new.reply_to is distinct from old.reply_to or new.expires_at is distinct from old.expires_at or new.view_once<>old.view_once or new.viewed_at is distinct from old.viewed_at then raise exception 'Immutable message fields'; end if;
 if new.body is distinct from old.body or new.enc is distinct from old.enc or new.edited_at is distinct from old.edited_at then
  if old.sender_id<>actor or old.deleted_at is not null or old.kind='system' or (old.expires_at is not null and old.expires_at<=now()) or old.created_at<now()-interval '15 minutes' then raise exception 'Editing window ended'; end if;
  new.edited_at:=now();
  if new.deleted_at is null and ((new.enc is null and (new.body is null or length(trim(new.body)) not between 1 and 4000))) then raise exception 'Invalid message body'; end if;
 end if;
 if new.deleted_at is distinct from old.deleted_at then
  if old.sender_id<>actor or old.kind='system' or old.deleted_at is not null then raise exception 'Only author may delete'; end if;
  new.deleted_at:=now(); new.body:=null; new.enc:=null; new.meta:=null; new.pinned_at:=null; new.pinned_by:=null;
 end if;
 if old.deleted_at is not null then new.body:=null; new.enc:=null; new.meta:=null; new.pinned_at:=null; new.pinned_by:=null; end if;
 if new.pinned_at is distinct from old.pinned_at and new.deleted_at is null then
  if old.kind='system' or (old.expires_at is not null and old.expires_at<=now()) then raise exception 'Cannot pin this message'; end if;
  new.pinned_at:=case when new.pinned_at is null then null else now() end;
  new.pinned_by:=case when new.pinned_at is null then null else actor end;
 elsif new.pinned_by is distinct from old.pinned_by and new.deleted_at is null then raise exception 'Invalid pin author'; end if;
 if new.read_at is distinct from old.read_at then
  if old.sender_id=actor or new.read_at is null then raise exception 'Only recipient may mark read'; end if;
  new.read_at:=coalesce(old.read_at,now());
 end if;
 return new;
end $$;

create or replace function chat_private.guard_voice() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.enc is not null or new.deleted_at is not null then
  if new.meta is not null and new.enc is not null then raise exception 'Encrypt voice metadata'; end if;
  return new;
 end if;
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

create or replace function public.chat_dispatch_schedule(job_id uuid, claim_attempt int) returns uuid language plpgsql security invoker set search_path='' as $$
declare j public.scheduled_jobs; message_id uuid; selected_body text; phrases jsonb; recurring jsonb; zone text; following timestamptz; local_day date;
begin
 select * into j from public.scheduled_jobs where id=job_id and kind='scheduled_message' for update;
 if not found or j.status<>'pending' or j.attempts<>claim_attempt or j.locked_until<=now() or j.run_at>now() then return null; end if;
 if not exists(select 1 from public.profiles where id=j.created_by and couple_id=j.couple_id) then return null; end if;
 select id into message_id from public.messages where couple_id=j.couple_id and client_id='scheduled:'||j.id::text;
 if message_id is not null then return message_id; end if;
 if j.payload->'enc' is not null then
  insert into public.messages(couple_id,sender_id,kind,body,meta,enc,client_id,reply_to)
  values(j.couple_id,j.created_by,'text',null,null,j.payload->'enc','scheduled:'||j.id::text,
   case when exists(select 1 from public.messages where couple_id=j.couple_id and id=nullif(j.payload->>'reply_to','')::uuid) then nullif(j.payload->>'reply_to','')::uuid else null end)
  returning id into message_id;
  return message_id;
 end if;
 selected_body:=j.payload->>'body'; phrases:=j.payload->'phrases'; recurring:=j.payload->'recurrence';
 if jsonb_typeof(phrases)='array' and jsonb_array_length(phrases)>0 then selected_body:=phrases->>floor(random()*jsonb_array_length(phrases))::int; end if;
 if selected_body is null or length(trim(selected_body)) not between 1 and 4000 then raise exception 'Invalid scheduled body'; end if;
 insert into public.messages(couple_id,sender_id,kind,body,client_id,reply_to) values(j.couple_id,j.created_by,'text',selected_body,'scheduled:'||j.id::text,
 case when exists(select 1 from public.messages where couple_id=j.couple_id and id=nullif(j.payload->>'reply_to','')::uuid) then nullif(j.payload->>'reply_to','')::uuid else null end) returning id into message_id;
 if jsonb_typeof(recurring)='object' then
  zone:=recurring->>'timezone';
  if not exists(select 1 from pg_timezone_names where name=zone) or (recurring->>'hour')::int not between 0 and 23 or (recurring->>'minute')::int not between 0 and 59 then raise exception 'Invalid recurrence'; end if;
  local_day:=greatest((j.run_at at time zone zone)::date,(now() at time zone zone)::date)+1;
  following:=(local_day+make_time((recurring->>'hour')::int,(recurring->>'minute')::int,0)) at time zone zone;
  insert into public.scheduled_jobs(id,couple_id,kind,run_at,payload,created_by) values(md5(j.id::text||following::text)::uuid,j.couple_id,'scheduled_message',following,j.payload||jsonb_build_object('client_id',md5(j.id::text||following::text)),j.created_by) on conflict(id) do nothing;
 end if;
 return message_id;
end $$;
revoke all on function public.chat_dispatch_schedule(uuid,int) from public,anon,authenticated;
grant execute on function public.chat_dispatch_schedule(uuid,int) to service_role;


commit;
