-- A switch that takes the website offline (Admin → Settings → Website availability).
-- While site_offline is on, visitors see only a notice (offline_title, and offline_note under it);
-- the admin still sees the whole site. middleware.ts reads these columns; the row is public, like the rest of site_settings.

alter table public.site_settings
  add column if not exists site_offline boolean not null default false,
  add column if not exists offline_title text not null default 'This website is not available right now',
  add column if not exists offline_note text not null default '',
  add column if not exists offline_since timestamptz;

alter table public.site_settings
  drop constraint if exists site_settings_offline_text_check,
  add constraint site_settings_offline_text_check
    check (length(offline_title) <= 120 and length(offline_note) <= 500);
