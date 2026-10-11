-- EDIT THESE TWO EMAILS before running this whole script in the SQL Editor.
-- Create both Auth users first. Rerunning reuses their couple, never creates
-- an orphan on failure, and refuses to move users from an existing couple.
begin;
do $$
declare
  email_one text := 'you@example.com';
  email_two text := 'partner@example.com';
  user_one uuid;
  user_two uuid;
  couple_one uuid;
  couple_two uuid;
  target_couple uuid;
begin
  if lower(email_one) = lower(email_two) then
    raise exception 'Enter two different email addresses';
  end if;
  select id into user_one from auth.users where lower(email) = lower(email_one);
  select id into user_two from auth.users where lower(email) = lower(email_two);
  if user_one is null or user_two is null then
    raise exception 'Create both email users in Authentication > Users first';
  end if;
  insert into public.profiles(id, display_name)
  select id, split_part(email, '@', 1) from auth.users
  where id in (user_one, user_two) on conflict (id) do nothing;
  -- Serialize repeated seed runs on these profiles.
  perform id from public.profiles where id in (user_one, user_two) order by id for update;
  select couple_id into couple_one from public.profiles where id = user_one;
  select couple_id into couple_two from public.profiles where id = user_two;
  if couple_one is not null and couple_two is not null and couple_one <> couple_two then
    raise exception 'These users already belong to different couples';
  end if;
  target_couple := coalesce(couple_one, couple_two);
  if target_couple is null then
    insert into public.couples default values returning id into target_couple;
  end if;
  perform id from public.couples where id = target_couple for update;
  if exists (select 1 from public.profiles where couple_id = target_couple and id not in (user_one, user_two)) then
    raise exception 'This couple already contains another user';
  end if;
  update public.profiles set couple_id = target_couple where id in (user_one, user_two);
  perform set_config('couple_app.seed_couple_id', target_couple::text, true);
end;
$$;
-- Both intended profiles must show the same non-null couple_id.
select p.id, u.email, p.display_name, p.couple_id
from public.profiles p join auth.users u on u.id = p.id
where p.couple_id = current_setting('couple_app.seed_couple_id')::uuid
order by p.couple_id, u.email;
commit;
