create table if not exists public.vault_items (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('photo', 'video', 'note')),
  enc jsonb not null,
  storage_path text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists vault_items_couple_created_idx
  on public.vault_items (couple_id, created_at desc) where deleted_at is null;
create index if not exists vault_items_owner_idx
  on public.vault_items (owner_id, couple_id);

alter table public.vault_items enable row level security;
drop policy if exists "vault_items_read_couple" on public.vault_items;
create policy "vault_items_read_couple" on public.vault_items
  for select to authenticated using (couple_id = public.my_couple_id());
drop policy if exists "vault_items_insert_owner" on public.vault_items;
create policy "vault_items_insert_owner" on public.vault_items
  for insert to authenticated with check (couple_id = public.my_couple_id() and owner_id = auth.uid());
drop policy if exists "vault_items_update_owner" on public.vault_items;
create policy "vault_items_update_owner" on public.vault_items
  for update to authenticated using (couple_id = public.my_couple_id() and owner_id = auth.uid())
  with check (couple_id = public.my_couple_id() and owner_id = auth.uid());
drop policy if exists "vault_items_delete_owner" on public.vault_items;
create policy "vault_items_delete_owner" on public.vault_items
  for delete to authenticated using (couple_id = public.my_couple_id() and owner_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('vault', 'vault', false)
on conflict (id) do update set public = false;

drop policy if exists "vault_storage_read_couple" on storage.objects;
create policy "vault_storage_read_couple" on storage.objects
  for select to authenticated using (
    bucket_id = 'vault'
    and (storage.foldername(name))[1] = public.my_couple_id()::text
    and (storage.foldername(name))[2] = 'vault'
  );
drop policy if exists "vault_storage_insert_couple" on storage.objects;
create policy "vault_storage_insert_couple" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'vault'
    and (storage.foldername(name))[1] = public.my_couple_id()::text
    and (storage.foldername(name))[2] = 'vault'
  );
drop policy if exists "vault_storage_delete_couple" on storage.objects;
create policy "vault_storage_delete_couple" on storage.objects
  for delete to authenticated using (
    bucket_id = 'vault'
    and (storage.foldername(name))[1] = public.my_couple_id()::text
    and (storage.foldername(name))[2] = 'vault'
  );

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'vault_items'
  ) then
    alter publication supabase_realtime add table public.vault_items;
  end if;
end $$;
