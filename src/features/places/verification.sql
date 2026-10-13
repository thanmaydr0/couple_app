-- Run as postgres. Every fixture and mutation is rolled back.
begin;
select set_config('places.test_user',(select id::text from public.profiles where couple_id is not null limit 1),true);
select set_config('places.test_couple',(select couple_id::text from public.profiles where id=current_setting('places.test_user')::uuid),true);
select set_config('places.test_other',gen_random_uuid()::text,true);
select set_config('places.test_row',gen_random_uuid()::text,true);
insert into public.couples(id) values(current_setting('places.test_other')::uuid);
insert into public.places(id,couple_id,name,lat,lon,kind,created_by)
values(current_setting('places.test_row')::uuid,current_setting('places.test_other')::uuid,'Places isolation fixture',0,0,'visited',current_setting('places.test_user')::uuid);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('places.test_user'),'role','authenticated')::text,true);
set local role authenticated;
do $$ declare saved uuid; n int; begin
 if exists(select 1 from public.places where id=current_setting('places.test_row')::uuid) then raise exception 'Cross-couple SELECT leaked'; end if;
 update public.places set notes='forbidden' where id=current_setting('places.test_row')::uuid;
 get diagnostics n=row_count; if n<>0 then raise exception 'Cross-couple UPDATE allowed'; end if;
 delete from public.places where id=current_setting('places.test_row')::uuid;
 get diagnostics n=row_count; if n<>0 then raise exception 'Cross-couple DELETE allowed'; end if;
 begin
  insert into public.places(couple_id,name,lat,lon,kind) values(current_setting('places.test_other')::uuid,'forbidden',0,0,'visited');
  raise exception 'Cross-couple INSERT allowed';
 exception when insufficient_privilege then null; end;
 insert into public.places(couple_id,name,country_code,lat,lon,kind,visited_on) values(current_setting('places.test_couple')::uuid,'Places CRUD fixture','IN',15.5,73.8,'visited','2026-01-01') returning id into saved;
 if not exists(select 1 from public.places where id=saved) then raise exception 'Own SELECT failed'; end if;
 update public.places set notes='Verified',kind='special' where id=saved;
 if not exists(select 1 from public.places where id=saved and notes='Verified' and kind='special') then raise exception 'Own UPDATE failed'; end if;
 begin
  update public.places set lat=91 where id=saved; raise exception 'Invalid latitude accepted';
 exception when check_violation then null; end;
 begin
  update public.places set kind='invalid' where id=saved; raise exception 'Invalid kind accepted';
 exception when check_violation then null; end;
 begin
  update public.places set media_ids=array[gen_random_uuid()] where id=saved;
  raise exception 'Missing linked photo accepted';
 exception when raise_exception then if sqlerrm<>'Linked photos must belong to this couple' then raise; end if; end;
 begin
  update public.places set couple_id=current_setting('places.test_other')::uuid where id=saved; raise exception 'Membership reassignment allowed';
 exception when insufficient_privilege then null; end;
 delete from public.places where id=saved;
 if exists(select 1 from public.places where id=saved) then raise exception 'Own DELETE failed'; end if;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
set local role authenticated;
do $$ begin if exists(select 1 from public.places) then raise exception 'Unpaired account leaked places'; end if; end $$;
reset role;
set local role anon;
do $$ begin begin perform count(*) from public.places; raise exception 'Anonymous read allowed'; exception when insufficient_privilege then null; end; end $$;
reset role;
select 'PASS: own CRUD, foreign CRUD denial, unpaired/anonymous isolation, constraints, linked photo validation, immutable membership' as result;
rollback;
