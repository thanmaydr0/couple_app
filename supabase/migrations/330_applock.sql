-- Requires 001_init.sql and 100_infra.sql. Reuses profiles.privacy, its RLS,
-- couple index and existing realtime publication; no new tables or columns.
-- Atomic JSONB merge preserves flags belonging to other feature sessions.
create or replace function public.set_applock_privacy(setting text, enabled boolean)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if setting is null or setting not in ('hide_message_previews', 'block_screenshots') or enabled is null then
    raise exception 'Invalid privacy preference';
  end if;
  update public.profiles
  set privacy = (case when jsonb_typeof(privacy) = 'object' then privacy else '{}'::jsonb end)
    || jsonb_build_object(setting, enabled)
  where id = auth.uid() and couple_id = (select public.my_couple_id())
  returning privacy into result;
  if not found then raise exception 'Your couple profile is unavailable'; end if;
  return result;
end;
$$;
revoke all on function public.set_applock_privacy(text, boolean) from public, anon;
grant execute on function public.set_applock_privacy(text, boolean) to authenticated;
