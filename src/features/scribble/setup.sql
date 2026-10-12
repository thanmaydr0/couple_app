-- Scribble-only private broadcast authorization. Existing table RLS is unchanged.
create policy scribble_broadcast_read on realtime.messages for select to authenticated
using (extension = 'broadcast' and exists (
  select 1 from public.scribble_matches m
  where 'scribble:' || m.id::text = (select realtime.topic())
    and m.couple_id = (select public.my_couple_id())
));
create policy scribble_broadcast_write on realtime.messages for insert to authenticated
with check (extension = 'broadcast' and exists (
  select 1 from public.scribble_matches m
  where 'scribble:' || m.id::text = (select realtime.topic())
    and m.couple_id = (select public.my_couple_id())
));
