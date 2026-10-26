-- The detailed About page, edited from Admin → About page.
-- Lists are JSON arrays of small objects; every section is optional and hidden when empty.
alter table public.site_settings
  add column if not exists about_services jsonb not null default '[]'::jsonb,
  add column if not exists about_experience jsonb not null default '[]'::jsonb,
  add column if not exists about_education jsonb not null default '[]'::jsonb,
  add column if not exists about_hobbies jsonb not null default '[]'::jsonb,
  add column if not exists about_clients text,
  add column if not exists about_personal text,
  add column if not exists about_photo_url text,
  add column if not exists about_photo_alt text;

alter table public.site_settings
  add constraint site_settings_about_lists check (
    jsonb_typeof(about_services) = 'array' and jsonb_typeof(about_experience) = 'array'
    and jsonb_typeof(about_education) = 'array' and jsonb_typeof(about_hobbies) = 'array'
  ),
  add constraint site_settings_about_list_sizes check (
    pg_column_size(about_services) + pg_column_size(about_experience)
    + pg_column_size(about_education) + pg_column_size(about_hobbies) < 200000
  ),
  add constraint site_settings_about_text check (
    (about_clients is null or char_length(about_clients) <= 3000)
    and (about_personal is null or char_length(about_personal) <= 12000)
    and (about_photo_alt is null or char_length(about_photo_alt) <= 200)
  ),
  add constraint site_settings_about_photo_https check (about_photo_url is null or about_photo_url like 'https://%');
