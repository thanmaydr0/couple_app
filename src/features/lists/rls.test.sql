-- Synthetic privacy fixtures; every change is rolled back.
begin;
insert into auth.users(id) values ('14000000-0000-4000-8000-000000000001'),('14000000-0000-4000-8000-000000000002'),('14000000-0000-4000-8000-000000000003');
insert into public.couples(id) values ('14000000-0000-4000-8000-000000000010'),('14000000-0000-4000-8000-000000000020');
insert into public.profiles(id,couple_id) values ('14000000-0000-4000-8000-000000000001','14000000-0000-4000-8000-000000000010'),('14000000-0000-4000-8000-000000000002','14000000-0000-4000-8000-000000000010'),('14000000-0000-4000-8000-000000000003','14000000-0000-4000-8000-000000000020') on conflict(id) do update set couple_id=excluded.couple_id;
set local role authenticated;
select set_config('request.jwt.claim.sub','14000000-0000-4000-8000-000000000001',true);
select public.lists_seed(); select public.lists_seed();
do $$ begin if (select count(*) from public.lists)<>5 then raise exception 'Seed not idempotent';end if;end $$;
insert into public.list_items(id,list_id,couple_id,title,added_by,hidden_from)
select '14000000-0000-4000-8000-000000000100',id,couple_id,'Secret picnic','14000000-0000-4000-8000-000000000001','14000000-0000-4000-8000-000000000002' from public.lists where kind='surprise';
insert into public.list_items(id,list_id,couple_id,title,added_by)
select '14000000-0000-4000-8000-000000000101',id,couple_id,'A wishlist book','14000000-0000-4000-8000-000000000001' from public.lists where kind='gifts';
select set_config('request.jwt.claim.sub','14000000-0000-4000-8000-000000000002',true);
select public.lists_seed();
do $$ begin
 if exists(select 1 from public.list_items where id='14000000-0000-4000-8000-000000000100') then raise exception 'Hidden item leaked';end if;
 if (select count(*) from public.lists where kind='surprise')<>1 then raise exception 'Private planner leaked';end if;
 if (select count(*) from public.list_items where id='14000000-0000-4000-8000-000000000101')<>1 then raise exception 'Wishlist not visible';end if;
end $$;
insert into public.list_items(id,list_id,couple_id,title,added_by,hidden_from,url)
select '14000000-0000-4000-8000-000000000102',id,couple_id,'Getting the book','14000000-0000-4000-8000-000000000002','14000000-0000-4000-8000-000000000001','us-list-claim:14000000-0000-4000-8000-000000000101' from public.lists where kind='gifts';
do $$ begin
 begin update public.list_items set revealed_at=now() where id='14000000-0000-4000-8000-000000000102';raise exception 'Claim reveal allowed';exception when raise_exception then if sqlerrm='Claim reveal allowed' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub','14000000-0000-4000-8000-000000000001',true);
do $$ begin
 if exists(select 1 from public.list_items where id='14000000-0000-4000-8000-000000000102') then raise exception 'Gift claim leaked to owner';end if;
 if not exists(select 1 from public.list_items where id='14000000-0000-4000-8000-000000000101') then raise exception 'Claim hid original wish';end if;
end $$;
update public.list_items set revealed_at=now() where id='14000000-0000-4000-8000-000000000100';
update public.list_items set done_at=now(),done_by=auth.uid(),rating_a=5 where id='14000000-0000-4000-8000-000000000100';
do $$ begin
 begin update public.list_items set rating_b=4 where id='14000000-0000-4000-8000-000000000100';raise exception 'Partner rating spoofed';exception when raise_exception then if sqlerrm='Partner rating spoofed' then raise;end if;end;
 begin update public.list_items set couple_id='14000000-0000-4000-8000-000000000020' where id='14000000-0000-4000-8000-000000000100';raise exception 'Ownership mutation allowed';exception when raise_exception then if sqlerrm='Ownership mutation allowed' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub','14000000-0000-4000-8000-000000000002',true);
do $$ begin if not exists(select 1 from public.list_items where id='14000000-0000-4000-8000-000000000100') then raise exception 'Reveal did not unlock';end if;end $$;
update public.list_items set rating_b=5 where id='14000000-0000-4000-8000-000000000100';
do $$ begin if not exists(select 1 from public.list_items where rating_a=5 and rating_b=5) then raise exception 'Ratings not preserved';end if;end $$;
select set_config('request.jwt.claim.sub','14000000-0000-4000-8000-000000000003',true);
do $$ begin if exists(select 1 from public.list_items) or exists(select 1 from public.lists) then raise exception 'Cross-couple leak';end if;end $$;
reset role;
select 'PASS: defaults, hidden surprises, private planners, gift visibility/claims, reveal, ratings, ownership, couple isolation' as result;
rollback;
