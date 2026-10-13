-- Shared backend setup: run once in Supabase SQL Editor. The app joins a
-- PRIVATE channel; no public fallback is used if authorization is missing.
begin;
drop policy if exists chat_typing_read on realtime.messages;
create policy chat_typing_read on realtime.messages
for select to authenticated
using (
  extension in ('broadcast','presence')
  and (select realtime.topic()) = 'chat-typing:' || (select public.my_couple_id())::text
);
drop policy if exists chat_typing_write on realtime.messages;
create policy chat_typing_write on realtime.messages
for insert to authenticated
with check (
  extension in ('broadcast','presence')
  and (select realtime.topic()) = 'chat-typing:' || (select public.my_couple_id())::text
);
commit;
