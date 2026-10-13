begin;
create table if not exists public.lists (
 id uuid primary key default gen_random_uuid(), couple_id uuid not null references public.couples(id) on delete cascade,
 kind text not null check(kind in ('bucket','dates','watch','gifts','surprise','custom')),
 title text not null check(length(trim(title)) between 1 and 160), emoji text not null default '✨',
 created_by uuid not null, created_at timestamptz not null default now(),
 foreign key(couple_id,created_by) references public.profiles(couple_id,id), unique(couple_id,id)
);
create unique index if not exists lists_default_kind on public.lists(couple_id,kind) where kind not in ('custom','surprise');
create unique index if not exists lists_private_planner on public.lists(couple_id,created_by) where kind='surprise';
create table if not exists public.list_items (
 id uuid primary key default gen_random_uuid(), list_id uuid not null, couple_id uuid not null references public.couples(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 500), notes text check(length(notes)<=4000), url text check(length(url)<=2000),
 added_by uuid not null, position int not null default 0, done_at timestamptz, done_by uuid,
 rating_a int check(rating_a between 1 and 5), rating_b int check(rating_b between 1 and 5), photo_path text,
 media_id uuid references public.media(id) on delete set null, revealed_at timestamptz, hidden_from uuid,
 created_at timestamptz not null default now(),
 foreign key(couple_id,list_id) references public.lists(couple_id,id) on delete cascade,
 foreign key(couple_id,added_by) references public.profiles(couple_id,id),
 foreign key(couple_id,hidden_from) references public.profiles(couple_id,id),
 foreign key(couple_id,done_by) references public.profiles(couple_id,id),
 check(hidden_from is null or hidden_from<>added_by), check((done_at is null)=(done_by is null))
);
create index if not exists list_items_order on public.list_items(couple_id,list_id,position,id);
create index if not exists list_items_media on public.list_items(media_id);
create unique index if not exists list_items_claim on public.list_items(couple_id,url) where url like 'us-list-claim:%';
alter table public.lists enable row level security;
alter table public.list_items enable row level security;
revoke all on public.lists,public.list_items from anon;
grant select,insert,update,delete on public.lists,public.list_items to authenticated;
drop policy if exists lists_read on public.lists;
create policy lists_read on public.lists for select to authenticated using(couple_id=public.my_couple_id() and (kind<>'surprise' or created_by=auth.uid()));
drop policy if exists lists_insert on public.lists;
create policy lists_insert on public.lists for insert to authenticated with check(couple_id=public.my_couple_id() and created_by=auth.uid());
drop policy if exists items_read on public.list_items;
create policy items_read on public.list_items for select to authenticated using(couple_id=public.my_couple_id() and (hidden_from is distinct from auth.uid() or revealed_at is not null));
drop policy if exists items_insert on public.list_items;
create policy items_insert on public.list_items for insert to authenticated with check(couple_id=public.my_couple_id() and added_by=auth.uid() and exists(select 1 from public.lists l where l.id=list_id and l.couple_id=list_items.couple_id));
drop policy if exists items_update on public.list_items;
create policy items_update on public.list_items for update to authenticated using(couple_id=public.my_couple_id() and (hidden_from is distinct from auth.uid() or revealed_at is not null)) with check(couple_id=public.my_couple_id() and (hidden_from is distinct from auth.uid() or revealed_at is not null));
drop policy if exists items_delete on public.list_items;
create policy items_delete on public.list_items for delete to authenticated using(couple_id=public.my_couple_id() and (hidden_from is distinct from auth.uid() or revealed_at is not null));
create or replace function public.lists_guard_item() returns trigger language plpgsql security invoker set search_path='' as $$
declare a uuid; target public.list_items; k text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select id into a from public.profiles where couple_id=new.couple_id order by id limit 1;
 if tg_op='UPDATE' then
  if (new.id,new.couple_id,new.list_id,new.added_by,new.created_at) is distinct from (old.id,old.couple_id,old.list_id,old.added_by,old.created_at) then raise exception 'Ownership is immutable'; end if;
  if old.revealed_at is not null and new.revealed_at is distinct from old.revealed_at then raise exception 'Reveal is permanent'; end if;
  if new.url like 'us-list-claim:%' and coalesce(old.url,'') not like 'us-list-claim:%' then raise exception 'Create a separate claim'; end if;
  if new.done_by is distinct from old.done_by and new.done_at is not distinct from old.done_at then raise exception 'Completion author is immutable'; end if;
  if new.hidden_from is distinct from old.hidden_from then raise exception 'Hidden recipient is immutable'; end if;
  if new.revealed_at is distinct from old.revealed_at and (old.added_by<>auth.uid() or old.url like 'us-list-claim:%') then raise exception 'Only the author can reveal'; end if;
  if new.rating_a is distinct from old.rating_a and auth.uid()<>a then raise exception 'Not your rating'; end if;
  if new.rating_b is distinct from old.rating_b and auth.uid()=a then raise exception 'Not your rating'; end if;
  if old.url like 'us-list-claim:%' and new is distinct from old then raise exception 'Remove a claim to change it'; end if;
 else
  if new.rating_a is not null or new.rating_b is not null then raise exception 'Rate after completion'; end if;
  select kind into k from public.lists where id=new.list_id;
  if k='surprise' and new.hidden_from is null then raise exception 'Surprises require a hidden recipient'; end if;
  if new.url like 'us-list-claim:%' then
   select * into target from public.list_items where id=substring(new.url from 15)::uuid and couple_id=new.couple_id;
   if target.id is null or target.list_id<>new.list_id or target.added_by=auth.uid() or new.hidden_from is distinct from target.added_by or new.revealed_at is not null or target.url like 'us-list-claim:%' or k<>'gifts' then raise exception 'Invalid gift claim'; end if;
  end if;
 end if;
 if new.done_at is not null and (tg_op='INSERT' or new.done_at is distinct from old.done_at) and new.done_by<>auth.uid() then raise exception 'Invalid completion author'; end if;
 if (new.rating_a is not null or new.rating_b is not null) and new.done_at is null then raise exception 'Complete before rating'; end if;
 if new.media_id is not null and not exists(select 1 from public.media m where m.id=new.media_id and m.couple_id=new.couple_id and m.storage_path=new.photo_path) then raise exception 'Memory must belong to this couple'; end if;
 return new;
end $$;
revoke all on function public.lists_guard_item() from public,anon;
drop trigger if exists lists_guard_item on public.list_items;
create trigger lists_guard_item before insert or update on public.list_items for each row execute function public.lists_guard_item();
create or replace function public.lists_seed() returns void language plpgsql security invoker set search_path='' as $$
begin
 if public.my_couple_id() is null then raise exception 'Couple required'; end if;
 insert into public.lists(couple_id,kind,title,emoji,created_by)
 select public.my_couple_id(),k,t,e,auth.uid() from (values ('bucket','Bucket List','🌟'),('dates','Date Ideas','💕'),('watch','Watch Together','🎬'),('gifts','Gift Ideas','🎁'),('surprise','Surprise Planner','🤫')) v(k,t,e) on conflict do nothing;
end $$;
revoke all on function public.lists_seed() from public,anon;
grant execute on function public.lists_seed() to authenticated;
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='lists') then alter publication supabase_realtime add table public.lists; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='list_items') then alter publication supabase_realtime add table public.list_items; end if;
 end if;
end $$;
commit;
