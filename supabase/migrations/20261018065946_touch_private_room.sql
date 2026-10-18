-- Ephemeral Touch rooms are visible only to members of the topic's couple.
-- realtime.messages already has RLS enabled and is owned by Supabase.
drop policy if exists touch_room_read on realtime.messages;
create policy touch_room_read on realtime.messages for select to authenticated
using (
  extension in ('broadcast', 'presence')
  and (select realtime.topic()) = 'touch:' || (select public.my_couple_id())::text
);

drop policy if exists touch_room_write on realtime.messages;
create policy touch_room_write on realtime.messages for insert to authenticated
with check (
  extension in ('broadcast', 'presence')
  and (select realtime.topic()) = 'touch:' || (select public.my_couple_id())::text
);
