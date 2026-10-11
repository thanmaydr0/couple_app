-- Run in the Supabase SQL Editor after the existing 001/002 migrations.
-- Review against any later policies before applying. No service key belongs in the app.
begin;
drop policy if exists couple_access on public.media;
drop policy if exists memories_select on public.media;
create policy memories_select on public.media for select to authenticated
using (couple_id = (select public.my_couple_id()));
drop policy if exists memories_insert on public.media;
create policy memories_insert on public.media for insert to authenticated
with check (
  couple_id = (select public.my_couple_id()) and uploader_id = (select auth.uid())
  and storage_path = couple_id::text || '/' || case when kind = 'photo' then 'photos/' else 'videos/' end || id::text || case when kind = 'photo' then '.jpg' else '.mp4' end
  and thumb_path = couple_id::text || '/thumbs/' || id::text || '.jpg'
  and size_bytes > 0 and size_bytes < 52428800
  and exists (select 1 from storage.objects o where o.bucket_id = 'media' and o.name = storage_path and o.owner_id = (select auth.uid())::text)
  and exists (select 1 from storage.objects o where o.bucket_id = 'media' and o.name = thumb_path and o.owner_id = (select auth.uid())::text)
);
drop policy if exists memories_caption on public.media;
create policy memories_caption on public.media for update to authenticated
using (couple_id = (select public.my_couple_id()))
with check (couple_id = (select public.my_couple_id()));
-- Immutable uploader and paths prevent reassignment to bypass deletion ownership.
revoke update on public.media from authenticated;
grant update(caption) on public.media to authenticated;
drop policy if exists memories_delete on public.media;
create policy memories_delete on public.media for delete to authenticated
using (couple_id = (select public.my_couple_id()) and uploader_id = (select auth.uid()));

-- Preserve couple read access and uploads in other features' folders.
-- Restrict overwrite/delete for Memories originals and previews to their owner.
drop policy if exists couple_media_update on storage.objects;
create policy couple_media_update on storage.objects for update to authenticated
using (
  bucket_id = 'media' and (storage.foldername(name))[1] = (select public.my_couple_id())::text
  and ((storage.foldername(name))[2] not in ('photos','videos','thumbs') or owner_id = (select auth.uid())::text)
)
with check (
  bucket_id = 'media' and (storage.foldername(name))[1] = (select public.my_couple_id())::text
  and ((storage.foldername(name))[2] not in ('photos','videos','thumbs') or owner_id = (select auth.uid())::text)
);
drop policy if exists couple_media_delete on storage.objects;
create policy couple_media_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'media' and (storage.foldername(name))[1] = (select public.my_couple_id())::text
  and ((storage.foldername(name))[2] not in ('photos','videos','thumbs')
    or owner_id = (select auth.uid())::text
    or exists (select 1 from public.media m where m.uploader_id = (select auth.uid()) and (m.storage_path = name or m.thumb_path = name)))
);
commit;
