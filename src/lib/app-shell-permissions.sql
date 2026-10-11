-- Applied to hosted project as app_shell_permissions. Keep alongside the shell
-- while schema/migration folders are outside this task's editable scope.
grant update(anniversary) on public.couples to authenticated;
drop policy if exists couples_update_anniversary on public.couples;
create policy couples_update_anniversary on public.couples for update to authenticated
using (id = (select public.my_couple_id()))
with check (id = (select public.my_couple_id()));

drop policy if exists couple_presence_read on realtime.messages;
create policy couple_presence_read on realtime.messages for select to authenticated
using (extension = 'presence' and (select realtime.topic()) = 'presence:' || (select public.my_couple_id())::text);
drop policy if exists couple_presence_write on realtime.messages;
create policy couple_presence_write on realtime.messages for insert to authenticated
with check (extension = 'presence' and (select realtime.topic()) = 'presence:' || (select public.my_couple_id())::text);
