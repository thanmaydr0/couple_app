-- Call-only Realtime authorization; existing calls table RLS remains in force.
begin;
drop policy if exists couple_calls_broadcast_read on realtime.messages;
create policy couple_calls_broadcast_read on realtime.messages for select to authenticated
using (extension = 'broadcast' and (select realtime.topic()) = 'call:' || (select public.my_couple_id())::text);
drop policy if exists couple_calls_broadcast_write on realtime.messages;
create policy couple_calls_broadcast_write on realtime.messages for insert to authenticated
with check (extension = 'broadcast' and (select realtime.topic()) = 'call:' || (select public.my_couple_id())::text);
commit;
