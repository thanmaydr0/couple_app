begin;
create table if not exists public.capsules (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  author_id uuid not null,
  title text not null default '' check (length(title) <= 160),
  body text not null default '' check (length(body) <= 30000),
  media_paths text[] not null default '{}' check (cardinality(media_paths) <= 6),
  voice_path text,
  kind text not null default 'letter' check (kind in ('letter','surprise','future_us')),
  unlock_at timestamptz not null,
  open_together boolean not null default false,
  ceremony_started_at timestamptz,
  opened_at timestamptz,
  opened_by uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  foreign key (couple_id,author_id) references public.profiles(couple_id,id)
);
create index if not exists capsules_couple_unlock on public.capsules(couple_id,unlock_at);
create index if not exists capsules_author on public.capsules(author_id);
alter table public.capsules enable row level security;
revoke all on public.capsules from anon,authenticated;
grant select,delete on public.capsules to authenticated;
grant insert(id,couple_id,author_id,title,body,media_paths,voice_path,kind,unlock_at,open_together) on public.capsules to authenticated;
grant update(title,body,media_paths,voice_path,kind,unlock_at,open_together) on public.capsules to authenticated;
grant all on public.capsules to service_role;
drop policy if exists capsule_read on public.capsules;
create policy capsule_read on public.capsules for select to authenticated using (
 couple_id = (select public.my_couple_id()) and (author_id = (select auth.uid()) or
 (unlock_at <= now() and (not open_together or ceremony_started_at is not null)))
);
drop policy if exists capsule_create on public.capsules;
create policy capsule_create on public.capsules for insert to authenticated with check (
 couple_id = (select public.my_couple_id()) and author_id = (select auth.uid()) and unlock_at > now()
);
drop policy if exists capsule_edit on public.capsules;
create policy capsule_edit on public.capsules for update to authenticated
 using (couple_id = (select public.my_couple_id()) and author_id = (select auth.uid()) and unlock_at > now())
 with check (couple_id = (select public.my_couple_id()) and author_id = (select auth.uid()) and unlock_at > now());
drop policy if exists capsule_delete on public.capsules;
create policy capsule_delete on public.capsules for delete to authenticated
 using (couple_id = (select public.my_couple_id()) and author_id = (select auth.uid()) and unlock_at > now());

-- A dedicated private bucket prevents the existing broad couple-media policies
-- (permissive policies are OR'ed) from accidentally exposing sealed photos.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values ('capsules','capsules',false,10485760,array['image/jpeg','image/png','image/webp','audio/m4a','audio/mp4','audio/mpeg'])
 on conflict(id) do nothing;
create or replace function public.capsule_unlocked(object_name text)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.capsules c where auth.uid() is not null
 and c.couple_id = public.my_couple_id()
 and split_part(object_name,'/',1) = c.couple_id::text
 and split_part(object_name,'/',2) = 'capsules'
 and split_part(object_name,'/',3) = c.id::text
 and (c.author_id = auth.uid() or (c.unlock_at <= now() and (not c.open_together or c.ceremony_started_at is not null))))
$$;
create or replace function public.capsule_media_writable(object_name text)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.capsules c where auth.uid() is not null
 and c.couple_id = public.my_couple_id() and c.author_id = auth.uid() and c.unlock_at > now()
 and split_part(object_name,'/',1) = c.couple_id::text
 and split_part(object_name,'/',2) = 'capsules' and split_part(object_name,'/',3) = c.id::text
 and split_part(object_name,'/',4) <> '' and split_part(object_name,'/',5) = '')
$$;
revoke all on function public.capsule_unlocked(text), public.capsule_media_writable(text) from public,anon;
grant execute on function public.capsule_unlocked(text), public.capsule_media_writable(text) to authenticated;
drop policy if exists capsule_objects_read on storage.objects;
create policy capsule_objects_read on storage.objects for select to authenticated
 using (bucket_id = 'capsules' and public.capsule_unlocked(name));
drop policy if exists capsule_objects_insert on storage.objects;
create policy capsule_objects_insert on storage.objects for insert to authenticated
 with check (bucket_id = 'capsules' and public.capsule_media_writable(name));
drop policy if exists capsule_objects_update on storage.objects;
create policy capsule_objects_update on storage.objects for update to authenticated
 using (bucket_id = 'capsules' and public.capsule_media_writable(name))
 with check (bucket_id = 'capsules' and public.capsule_media_writable(name));
drop policy if exists capsule_objects_delete on storage.objects;
create policy capsule_objects_delete on storage.objects for delete to authenticated
 using (bucket_id = 'capsules' and public.capsule_media_writable(name));

create or replace function public.capsule_stubs()
returns table(id uuid,author_id uuid,title_hint text,unlock_at timestamptz,has_media boolean,kind text,opened_at timestamptz,open_together boolean,ready boolean,server_now timestamptz)
language sql stable security definer set search_path = '' as $$
 select c.id,c.author_id,case when c.unlock_at <= now() and (not c.open_together or c.ceremony_started_at is not null) then c.title else null end,
 c.unlock_at,cardinality(c.media_paths)>0 or c.voice_path is not null,c.kind,c.opened_at,c.open_together,c.unlock_at <= now(),now()
 from public.capsules c where auth.uid() is not null and c.couple_id = public.my_couple_id() and c.author_id <> auth.uid()
 order by c.unlock_at
$$;
create or replace function public.capsule_clock() returns timestamptz
language sql stable security invoker set search_path = '' as $$ select now() $$;
revoke all on function public.capsule_stubs(),public.capsule_clock() from public,anon;
grant execute on function public.capsule_stubs(),public.capsule_clock() to authenticated;

-- Holds use authenticated RPCs, never client-supplied user IDs or presence payloads.
create table if not exists public.capsule_holds (
 capsule_id uuid not null references public.capsules(id) on delete cascade,
 couple_id uuid not null references public.couples(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 started_at timestamptz not null, heartbeat_at timestamptz not null,
 primary key(capsule_id,user_id)
);
create index if not exists capsule_holds_couple on public.capsule_holds(couple_id);
alter table public.capsule_holds enable row level security;
revoke all on public.capsule_holds from anon,authenticated;
grant select on public.capsule_holds to authenticated;
grant all on public.capsule_holds to service_role;
drop policy if exists capsule_holds_read on public.capsule_holds;
create policy capsule_holds_read on public.capsule_holds for select to authenticated using (couple_id = (select public.my_couple_id()));
create or replace function public.capsule_hold(capsule uuid,holding boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare c public.capsules; participants integer; members integer;
begin
 select * into c from public.capsules where id = capsule and couple_id = public.my_couple_id() for update;
 if c.id is null or auth.uid() is null then raise exception 'Capsule unavailable'; end if;
 if not holding then delete from public.capsule_holds where capsule_id = capsule and user_id = auth.uid(); return false; end if;
 if c.unlock_at > now() then raise exception 'Capsule is sealed'; end if;
 if c.opened_at is not null then
   update public.capsules set opened_by = case when auth.uid() = any(opened_by) then opened_by else array_append(opened_by,auth.uid()) end where id = capsule;
   return true;
 end if;
 insert into public.capsule_holds(capsule_id,couple_id,user_id,started_at,heartbeat_at)
 values(c.id,c.couple_id,auth.uid(),now(),now()) on conflict(capsule_id,user_id) do update
 set started_at = case when public.capsule_holds.heartbeat_at < now()-interval '3 seconds' then now() else public.capsule_holds.started_at end, heartbeat_at = now();
 select count(*) into members from public.profiles where couple_id = c.couple_id;
 select count(*) into participants from public.capsule_holds h join public.profiles p on p.id=h.user_id and p.couple_id=h.couple_id
 where h.capsule_id=c.id and h.heartbeat_at >= now()-interval '3 seconds' and h.started_at <= now()-interval '1 second';
 if (c.open_together and members=2 and participants=2) or (not c.open_together and exists(select 1 from public.capsule_holds where capsule_id=c.id and user_id=auth.uid() and started_at <= now()-interval '1 second')) then
   update public.capsules set ceremony_started_at=now(),opened_at=now(),opened_by = case when c.open_together then (select array_agg(user_id) from public.capsule_holds where capsule_id=c.id and heartbeat_at >= now()-interval '3 seconds') else array[auth.uid()] end where id=c.id;
   delete from public.capsule_holds where capsule_id=c.id;
   return true;
 end if;
 return false;
end $$;
revoke all on function public.capsule_hold(uuid,boolean) from public,anon;
grant execute on function public.capsule_hold(uuid,boolean) to authenticated;

create or replace function public.capsule_validate()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare prefix text;
begin
 prefix := new.couple_id::text || '/capsules/' || new.id::text || '/';
 if exists(select 1 from unnest(new.media_paths) p where p is null or left(p,length(prefix)) <> prefix or substring(p from length(prefix)+1) !~ '^[a-zA-Z0-9_.-]+$')
 or (new.voice_path is not null and (left(new.voice_path,length(prefix)) <> prefix or substring(new.voice_path from length(prefix)+1) !~ '^[a-zA-Z0-9_.-]+$')) then raise exception 'Invalid capsule media path'; end if;
 return new;
end $$;
drop trigger if exists capsule_validate on public.capsules;
create trigger capsule_validate before insert or update on public.capsules for each row execute function public.capsule_validate();
create or replace function public.capsule_schedule()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if tg_op <> 'INSERT' then
   if tg_op = 'UPDATE' and new.unlock_at = old.unlock_at then return new; end if;
   update public.scheduled_jobs set status='cancelled',locked_until=null where kind='capsule_unlock' and couple_id=old.couple_id and payload->>'capsule_id'=old.id::text and status='pending';
 end if;
 if tg_op <> 'DELETE' then
   insert into public.scheduled_jobs(couple_id,kind,run_at,payload,created_by) values(new.couple_id,'capsule_unlock',new.unlock_at,jsonb_build_object('capsule_id',new.id),new.author_id);
   return new;
 end if;
 return old;
end $$;
revoke all on function public.capsule_schedule(),public.capsule_validate() from public,anon,authenticated;
drop trigger if exists capsule_schedule on public.capsules;
create trigger capsule_schedule after insert or update or delete on public.capsules for each row execute function public.capsule_schedule();
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='capsules') then alter publication supabase_realtime add table public.capsules; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='capsule_holds') then alter publication supabase_realtime add table public.capsule_holds; end if;
end $$;
commit;
