-- The large photo beside the home page heading, editable in Admin → Site content.
-- Until one is uploaded the site uses public/chidera-photo.webp.
alter table public.site_settings
  add column if not exists hero_photo_url text,
  add column if not exists hero_photo_alt text;

alter table public.site_settings
  add constraint site_settings_hero_photo_https check (hero_photo_url is null or hero_photo_url like 'https://%'),
  add constraint site_settings_hero_photo_alt_length check (hero_photo_alt is null or char_length(hero_photo_alt) <= 200);
