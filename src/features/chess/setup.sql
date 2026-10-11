-- Apply after the base schema. Shared migration files are outside this task.
-- Resolve any existing duplicate active games before applying this index.
create unique index if not exists chess_one_active_per_couple
on public.chess_games(couple_id) where status = 'active';

-- Private couple-scoped broadcast; postgres_changes uses existing table RLS.
drop policy if exists chess_broadcast_read on realtime.messages;
create policy chess_broadcast_read on realtime.messages for select to authenticated
using (extension = 'broadcast' and (select realtime.topic()) = 'chess:' || (select public.my_couple_id())::text);
drop policy if exists chess_broadcast_write on realtime.messages;
create policy chess_broadcast_write on realtime.messages for insert to authenticated
with check (extension = 'broadcast' and (select realtime.topic()) = 'chess:' || (select public.my_couple_id())::text);
