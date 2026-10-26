-- Storage only deletes files the caller can also select, so admins need read access
-- to the image bucket to remove old uploads (replaced portraits, unused covers).
create policy "Admins read article images" on storage.objects
  for select to authenticated
  using (bucket_id = 'article-images' and (select private.is_admin()));
