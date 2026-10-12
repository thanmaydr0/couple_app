-- Watch feature only. Existing watch_sessions schema/RLS/publication is required.
-- Keep this SQL in the feature folder: shared migration files are read-only.
begin;
drop policy if exists watch_broadcast_read on realtime.messages;
create policy watch_broadcast_read on realtime.messages for select to authenticated
using (
  extension = 'broadcast' and exists (
    select 1 from public.watch_sessions s
    where 'watch:' || s.id::text = (select realtime.topic())
      and s.couple_id = (select public.my_couple_id())
  )
);
drop policy if exists watch_broadcast_write on realtime.messages;
create policy watch_broadcast_write on realtime.messages for insert to authenticated
with check (
  extension = 'broadcast' and exists (
    select 1 from public.watch_sessions s
    where 'watch:' || s.id::text = (select realtime.topic())
      and s.couple_id = (select public.my_couple_id())
  )
);
commit;
