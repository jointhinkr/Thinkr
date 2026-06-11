-- Profile pictures + image/video on posts, backed by Supabase Storage.
alter table public.profiles add column if not exists avatar_url text;
alter table public.thoughts add column if not exists media_url text;
alter table public.thoughts add column if not exists media_type text check (media_type in ('image','video'));

-- public-read buckets with size + mime limits
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars','avatars', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'];

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media','media', true, 104857600, array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm'])
on conflict (id) do update set public = true, file_size_limit = 104857600,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm'];

-- storage RLS: public read; users write only inside their own <uid>/ folder
drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read" on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists "avatars user write" on storage.objects;
create policy "avatars user write" on storage.objects for insert with check (bucket_id='avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars user update" on storage.objects;
create policy "avatars user update" on storage.objects for update using (bucket_id='avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars user delete" on storage.objects;
create policy "avatars user delete" on storage.objects for delete using (bucket_id='avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "media public read" on storage.objects;
create policy "media public read" on storage.objects for select using (bucket_id = 'media');
drop policy if exists "media user write" on storage.objects;
create policy "media user write" on storage.objects for insert with check (bucket_id='media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "media user delete" on storage.objects;
create policy "media user delete" on storage.objects for delete using (bucket_id='media' and (storage.foldername(name))[1] = auth.uid()::text);
