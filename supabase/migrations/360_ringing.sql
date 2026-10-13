-- Reuses the existing durable calls row; no duplicate invite table or sensitive SDP storage.
begin;
alter table public.calls enable row level security;
create index if not exists calls_pending_couple_caller_idx
  on public.calls(couple_id, caller_id, started_at desc) where status = 'ringing';
drop policy if exists couple_calls_broadcast_read on realtime.messages;
create policy couple_calls_broadcast_read on realtime.messages for select to authenticated
using (extension = 'broadcast' and (select realtime.topic()) = 'call:' || (select public.my_couple_id())::text);
drop policy if exists couple_calls_broadcast_write on realtime.messages;
create policy couple_calls_broadcast_write on realtime.messages for insert to authenticated
with check (extension = 'broadcast' and (select realtime.topic()) = 'call:' || (select public.my_couple_id())::text);
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'calls') then
    alter publication supabase_realtime add table public.calls;
  end if;
end $$;
commit;
