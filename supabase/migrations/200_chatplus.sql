begin;
drop policy if exists chat_typing_read on realtime.messages;
create policy chat_typing_read on realtime.messages for select to authenticated using(extension in ('broadcast','presence') and (select realtime.topic())='chat-typing:'||(select public.my_couple_id())::text);
drop policy if exists chat_typing_write on realtime.messages;
create policy chat_typing_write on realtime.messages for insert to authenticated with check(extension in ('broadcast','presence') and (select realtime.topic())='chat-typing:'||(select public.my_couple_id())::text);
alter table public.messages add column if not exists edited_at timestamptz;
alter table public.messages add column if not exists deleted_at timestamptz;
alter table public.messages add column if not exists pinned_at timestamptz;
alter table public.messages add column if not exists pinned_by uuid;
alter table public.messages add column if not exists expires_at timestamptz;
alter table public.messages add column if not exists view_once boolean not null default false;
alter table public.messages add column if not exists viewed_at timestamptz;
create index if not exists messages_chat_pins_idx on public.messages(couple_id,pinned_at desc) where pinned_at is not null;
create index if not exists messages_chat_expiry_idx on public.messages(couple_id,expires_at) where expires_at is not null;
create index if not exists messages_chat_reply_idx on public.messages(couple_id,reply_to);
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages for select to authenticated using(couple_id=(select public.my_couple_id()) and (expires_at is null or expires_at>now()));

create table if not exists public.message_reactions (
  message_id uuid not null, couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null, emoji text not null check(char_length(emoji) between 1 and 32),
  created_at timestamptz not null default now(), primary key(message_id,user_id),
  foreign key(couple_id,message_id) references public.messages(couple_id,id) on delete cascade,
  foreign key(couple_id,user_id) references public.profiles(couple_id,id)
);
create index if not exists message_reactions_couple_idx on public.message_reactions(couple_id,message_id);
create index if not exists message_reactions_user_idx on public.message_reactions(couple_id,user_id);
create table if not exists public.chat_settings (
  couple_id uuid primary key references public.couples(id) on delete cascade,
  disappearing_seconds int not null default 0 check(disappearing_seconds in (0,3600,86400,604800))
);
create table if not exists public.link_previews (
  couple_id uuid not null references public.couples(id) on delete cascade, url text not null check(length(url)<=2048),
  title text not null default '', description text not null default '', image text,
  fetched_at timestamptz not null default now(), primary key(couple_id,url)
);
create index if not exists link_previews_age_idx on public.link_previews(fetched_at);
alter table public.message_reactions enable row level security;
alter table public.chat_settings enable row level security;
alter table public.link_previews enable row level security;
revoke all on public.message_reactions,public.chat_settings,public.link_previews from anon,authenticated;
grant select,insert,update,delete on public.message_reactions to authenticated;
grant select on public.chat_settings,public.link_previews to authenticated;
grant all on public.message_reactions,public.chat_settings,public.link_previews to service_role;
drop policy if exists chat_reactions_read on public.message_reactions;
create policy chat_reactions_read on public.message_reactions for select to authenticated using(couple_id=(select public.my_couple_id()));
drop policy if exists chat_reactions_write on public.message_reactions;
create policy chat_reactions_write on public.message_reactions for all to authenticated
 using(couple_id=(select public.my_couple_id()) and user_id=(select auth.uid()))
 with check(couple_id=(select public.my_couple_id()) and user_id=(select auth.uid()) and exists(
 select 1 from public.messages m where m.id=message_id and m.couple_id=message_reactions.couple_id and m.deleted_at is null and (m.expires_at is null or m.expires_at>now())));
drop policy if exists chat_settings_read on public.chat_settings;
create policy chat_settings_read on public.chat_settings for select to authenticated using(couple_id=(select public.my_couple_id()));
drop policy if exists chat_previews_read on public.link_previews;
create policy chat_previews_read on public.link_previews for select to authenticated using(couple_id=(select public.my_couple_id()));

-- Only named columns are writable; the trigger separates sender edits, partner
-- receipts and shared pin actions. Direct DELETE is replaced by a tombstone.
revoke delete on public.messages from authenticated;
grant update(body,edited_at,deleted_at,pinned_at,pinned_by) on public.messages to authenticated;
drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages for update to authenticated
 using(couple_id=(select public.my_couple_id())) with check(couple_id=(select public.my_couple_id()));
create schema if not exists chat_private;
revoke all on schema chat_private from public,anon,authenticated;
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
  if new.kind='text' and (new.body is null or length(trim(new.body)) not between 1 and 4000) then raise exception 'Invalid message body'; end if;
  select disappearing_seconds into ttl from public.chat_settings where couple_id=new.couple_id;
  new.expires_at:=case when coalesce(ttl,0)>0 and new.kind<>'system' then now()+make_interval(secs=>ttl) else null end;
  return new;
 end if;
 if actor is null then return new; end if;
 if new.couple_id is distinct from old.couple_id or new.sender_id<>old.sender_id or new.id<>old.id or new.client_id<>old.client_id or new.created_at<>old.created_at or new.kind<>old.kind or new.media_path is distinct from old.media_path or new.reply_to is distinct from old.reply_to or new.expires_at is distinct from old.expires_at or new.view_once<>old.view_once or new.viewed_at is distinct from old.viewed_at then raise exception 'Immutable message fields'; end if;
 if new.body is distinct from old.body or new.edited_at is distinct from old.edited_at then
  if old.sender_id<>actor or old.deleted_at is not null or old.kind='system' or (old.expires_at is not null and old.expires_at<=now()) or old.created_at<now()-interval '15 minutes' then raise exception 'Editing window ended'; end if;
  new.edited_at:=now();
  if new.deleted_at is null and (new.body is null or length(trim(new.body)) not between 1 and 4000) then raise exception 'Invalid message body'; end if;
 end if;
 if new.deleted_at is distinct from old.deleted_at then
  if old.sender_id<>actor or old.kind='system' or old.deleted_at is not null then raise exception 'Only author may delete'; end if;
  new.deleted_at:=now(); new.body:=null; new.pinned_at:=null; new.pinned_by:=null;
 end if;
 if old.deleted_at is not null then new.body:=null; new.pinned_at:=null; new.pinned_by:=null; end if;
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
drop trigger if exists chat_message_guard on public.messages;
create trigger chat_message_guard before insert or update on public.messages for each row execute function chat_private.guard_message();

-- Queue cleanup transactionally, including storage removal after tombstoning.
create or replace function chat_private.queue_cleanup() returns trigger language plpgsql security definer set search_path='' as $$
declare due timestamptz;
begin
 due:=new.expires_at;
 if new.deleted_at is not null and old.deleted_at is null then due:=now(); end if;
 if new.viewed_at is not null and old.viewed_at is null then due:=least(coalesce(due,'infinity'),new.viewed_at+interval '60 seconds'); end if;
 if due is not null and (tg_op='INSERT' or due is distinct from old.expires_at or new.deleted_at is distinct from old.deleted_at or new.viewed_at is distinct from old.viewed_at) then
  insert into public.scheduled_jobs(couple_id,kind,run_at,payload,created_by) values(new.couple_id,'disappearing_purge',due,jsonb_build_object('message_id',new.id),new.sender_id);
 end if;
 return new;
end $$;
drop trigger if exists chat_cleanup_queue on public.messages;
create trigger chat_cleanup_queue after insert or update on public.messages for each row execute function chat_private.queue_cleanup();

create or replace function public.chat_set_timer(seconds int) returns void language plpgsql security definer set search_path='' as $$
declare cid uuid:=public.my_couple_id(); label text; previous int;
begin
 if auth.uid() is null or cid is null or seconds not in(0,3600,86400,604800) then raise exception 'Invalid timer'; end if;
 perform 1 from public.couples where id=cid for update;
 select disappearing_seconds into previous from public.chat_settings where couple_id=cid;
 if coalesce(previous,0)=seconds then return; end if;
 insert into public.chat_settings(couple_id,disappearing_seconds) values(cid,seconds) on conflict(couple_id) do update set disappearing_seconds=excluded.disappearing_seconds;
 label:=case seconds when 0 then 'Off' when 3600 then '1 hour' when 86400 then '24 hours' else '7 days' end;
 -- The invoker trigger sees this function's trusted owner for system inserts.
 insert into public.messages(couple_id,sender_id,kind,body,client_id) values(cid,auth.uid(),'system','Disappearing messages: '||label,gen_random_uuid()::text);
end $$;
revoke all on function public.chat_set_timer(int) from public,anon;
grant execute on function public.chat_set_timer(int) to authenticated;

-- Atomic job editing/cancelling locks the same row as claim_scheduled_jobs.
-- A claimed job cannot be edited, preventing a late send after cancellation.
create or replace function public.chat_edit_schedule(job_id uuid, message_body text, due timestamptz, cancel boolean default false, phrases jsonb default null, recurrence jsonb default null)
returns void language plpgsql security definer set search_path='' as $$
declare j public.scheduled_jobs;
begin
 select * into j from public.scheduled_jobs where id=job_id and couple_id=public.my_couple_id() and created_by=auth.uid() and kind='scheduled_message' for update;
 if not found or j.status<>'pending' or j.locked_until is not null then raise exception 'Message already claimed or unavailable'; end if;
 if exists(select 1 from public.messages where couple_id=j.couple_id and client_id='scheduled:'||j.id::text) then raise exception 'Message already sent'; end if;
 if cancel then update public.scheduled_jobs set status='cancelled',payload='{}' where id=j.id; return; end if;
 if due<=now() or length(trim(message_body)) not between 1 and 4000 then raise exception 'Invalid schedule'; end if;
 update public.scheduled_jobs set run_at=due,payload=j.payload||jsonb_build_object('body',message_body,'phrases',phrases,'recurrence',recurrence) where id=j.id;
end $$;
revoke all on function public.chat_edit_schedule(uuid,text,timestamptz,boolean,jsonb,jsonb) from public,anon;
grant execute on function public.chat_edit_schedule(uuid,text,timestamptz,boolean,jsonb,jsonb) to authenticated;
-- Shared job cancellation must not bypass the author/lease RPC or cancel
-- privacy cleanup. Other features retain their existing policies.
drop policy if exists chat_jobs_updates on public.scheduled_jobs;
create policy chat_jobs_updates on public.scheduled_jobs as restrictive for update to authenticated
 using(kind not in('scheduled_message','disappearing_purge')) with check(kind not in('scheduled_message','disappearing_purge'));
drop policy if exists chat_jobs_private_body on public.scheduled_jobs;
create policy chat_jobs_private_body on public.scheduled_jobs as restrictive for select to authenticated using(kind<>'scheduled_message' or created_by=(select auth.uid()));
drop policy if exists chat_jobs_cleanup_insert on public.scheduled_jobs;
create policy chat_jobs_cleanup_insert on public.scheduled_jobs as restrictive for insert to authenticated with check(kind<>'disappearing_purge');

-- Service worker atomically checks the lease, deduplicates the insert and queues
-- the next local-calendar occurrence. Retries never duplicate a message/job.
create or replace function public.chat_dispatch_schedule(job_id uuid, claim_attempt int) returns uuid language plpgsql security invoker set search_path='' as $$
declare j public.scheduled_jobs; message_id uuid; selected_body text; phrases jsonb; recurring jsonb; zone text; following timestamptz; local_day date;
begin
 select * into j from public.scheduled_jobs where id=job_id and kind='scheduled_message' for update;
 if not found or j.status<>'pending' or j.attempts<>claim_attempt or j.locked_until<=now() or j.run_at>now() then return null; end if;
 if not exists(select 1 from public.profiles where id=j.created_by and couple_id=j.couple_id) then return null; end if;
 select id into message_id from public.messages where couple_id=j.couple_id and client_id='scheduled:'||j.id::text;
 if message_id is not null then return message_id; end if;
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

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('chat-once','chat-once',false,5242880,array['image/jpeg']) on conflict(id) do nothing;
drop policy if exists chat_once_upload on storage.objects;
create policy chat_once_upload on storage.objects for insert to authenticated with check(bucket_id='chat-once' and (storage.foldername(name))[1]=(select public.my_couple_id())::text and (storage.foldername(name))[2]='chat-once' and (storage.foldername(name))[3]=(select auth.uid())::text);
-- No SELECT policy: only the verified Edge Function can issue a short-lived URL.
create or replace function public.chat_claim_once(message_id uuid, viewer uuid, cid uuid) returns text language plpgsql security invoker set search_path='' as $$
declare path text;
begin
 if not exists(select 1 from public.profiles where id=viewer and couple_id=cid) then return null; end if;
 update public.messages set viewed_at=now() where id=message_id and couple_id=cid and sender_id<>viewer and view_once and viewed_at is null and deleted_at is null and (expires_at is null or expires_at>now()) returning media_path into path;
 return path;
end $$;
revoke all on function public.chat_claim_once(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.chat_claim_once(uuid,uuid,uuid) to service_role;

-- Purging a quoted message must not be blocked by its reply FK.
-- Drop only the FK which references reply_to (its generated name may vary).
do $$ declare constraint_name text; begin
 for constraint_name in select c.conname from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attname='reply_to' where c.conrelid='public.messages'::regclass and c.contype='f' and a.attnum=any(c.conkey) loop execute format('alter table public.messages drop constraint %I',constraint_name); end loop;
end $$;
alter table public.messages add constraint messages_chat_reply_fk foreign key(couple_id,reply_to) references public.messages(couple_id,id) on delete set null (reply_to);
do $$ declare t text; begin
 foreach t in array array['messages','message_reactions','chat_settings','link_previews'] loop
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t); end if;
 end loop;
end $$;
commit;
