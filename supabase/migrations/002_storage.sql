begin;
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 52428800, array['image/*', 'video/*'])
on conflict (id) do update set
  public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage objects already have RLS on hosted Supabase; do not change ownership
-- or grants on its managed tables. Both old AND new paths must be authorized.
drop policy if exists couple_media_select on storage.objects;
create policy couple_media_select on storage.objects for select to authenticated
using (bucket_id = 'media' and (storage.foldername(name))[1] = (select public.my_couple_id())::text);
drop policy if exists couple_media_insert on storage.objects;
create policy couple_media_insert on storage.objects for insert to authenticated
with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select public.my_couple_id())::text);
drop policy if exists couple_media_update on storage.objects;
create policy couple_media_update on storage.objects for update to authenticated
using (bucket_id = 'media' and (storage.foldername(name))[1] = (select public.my_couple_id())::text)
with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select public.my_couple_id())::text);
drop policy if exists couple_media_delete on storage.objects;
create policy couple_media_delete on storage.objects for delete to authenticated
using (bucket_id = 'media' and (storage.foldername(name))[1] = (select public.my_couple_id())::text);
-- Paths: <couple_id>/{photos,videos,thumbs,avatars,chat}/<filename>
commit;
