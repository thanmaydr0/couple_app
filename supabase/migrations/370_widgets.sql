-- Widgets: couple-scoped private doodles and headless heartbeat delivery.
create table if not exists public.doodles (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  image_path text not null unique,
  created_at timestamptz not null default now(),
  constraint doodles_owned_path check (image_path like couple_id::text || '/' || author_id::text || '/%.png')
);
create index if not exists doodles_couple_created on public.doodles(couple_id, created_at desc);
create index if not exists doodles_author_created on public.doodles(author_id, created_at desc);
alter table public.doodles enable row level security;
revoke all on public.doodles from anon, authenticated;
grant select, insert, delete on public.doodles to authenticated;
drop policy if exists doodles_read on public.doodles;
create policy doodles_read on public.doodles for select to authenticated using (couple_id = (select public.my_couple_id()));
drop policy if exists doodles_insert on public.doodles;
create policy doodles_insert on public.doodles for insert to authenticated with check (couple_id = (select public.my_couple_id()) and author_id = (select auth.uid()) and created_at between now() - interval '1 minute' and now() + interval '1 minute');
drop policy if exists doodles_delete on public.doodles;
create policy doodles_delete on public.doodles for delete to authenticated using (couple_id = (select public.my_couple_id()) and author_id = (select auth.uid()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('doodles','doodles',false,1000000,array['image/png']) on conflict(id) do nothing;
drop policy if exists widgets_doodle_read on storage.objects;
create policy widgets_doodle_read on storage.objects for select to authenticated using (bucket_id = 'doodles' and (storage.foldername(name))[1] = (select public.my_couple_id())::text);
drop policy if exists widgets_doodle_upload on storage.objects;
create policy widgets_doodle_upload on storage.objects for insert to authenticated with check (bucket_id = 'doodles' and (storage.foldername(name))[1] = (select public.my_couple_id())::text and (storage.foldername(name))[2] = (select auth.uid())::text);
drop policy if exists widgets_doodle_delete on storage.objects;
create policy widgets_doodle_delete on storage.objects for delete to authenticated using (bucket_id = 'doodles' and (storage.foldername(name))[1] = (select public.my_couple_id())::text and (storage.foldername(name))[2] = (select auth.uid())::text);
do $$ begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') and not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='doodles') then
    alter publication supabase_realtime add table public.doodles;
  end if;
end $$;

-- Invoker preserves Pulse's RLS. Serialize taps to enforce a server-side cooldown.
-- Pulse 110 migration must precede this file; no new widget event table is needed.
create or replace function public.widget_heartbeat() returns boolean
language plpgsql security invoker set search_path = '' as $$
declare who uuid := auth.uid(); couple uuid := public.my_couple_id();
begin
  if who is null or couple is null then raise exception 'Couple membership required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(who::text || ':widget-heart', 0));
  if exists (select 1 from public.pulse_heartbeats where user_id=who and couple_id=couple and created_at > now() - interval '10 seconds') then return false; end if;
  insert into public.pulse_heartbeats(couple_id,user_id,day) values (couple,who,pulse_private.today());
  return true;
end $$;
revoke all on function public.widget_heartbeat() from public,anon;
grant execute on function public.widget_heartbeat() to authenticated;

-- Only the server can claim a doodle push. Retries cannot spam the same upload.
create table if not exists public.widget_push_claims (
  doodle_id uuid primary key references public.doodles(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists widget_push_claims_couple_created on public.widget_push_claims(couple_id,created_at desc);
alter table public.widget_push_claims enable row level security;
revoke all on public.widget_push_claims from anon,authenticated;
-- Claim receipts are server-only bookkeeping, not a live table.
grant select,insert,delete on public.widget_push_claims to service_role;
create or replace function public.claim_widget_push(target uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare pair uuid;
begin
  select couple_id into pair from public.doodles where id=target;
  if pair is null then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(pair::text || ':widget-push',0));
  if exists(select 1 from public.widget_push_claims where couple_id=pair and created_at > now() - interval '30 seconds') then return false; end if;
  insert into public.widget_push_claims(doodle_id,couple_id) values(target,pair) on conflict do nothing;
  return found;
end $$;
revoke all on function public.claim_widget_push(uuid) from public,anon,authenticated;
grant execute on function public.claim_widget_push(uuid) to service_role;
