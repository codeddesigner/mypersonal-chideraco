-- The site switch: when site_offline is on, visitors see a "not available" page instead of the site.
-- Admins still get in, and Admin → Settings turns it back on.
alter table public.site_settings
  add column if not exists site_offline boolean not null default false,
  add column if not exists offline_title text not null default 'This website is not available right now',
  add column if not exists offline_note text not null default '',
  add column if not exists offline_since timestamptz;

alter table public.site_settings
  drop constraint if exists site_settings_offline_text_check,
  add constraint site_settings_offline_text_check
    check (length(offline_title) <= 120 and length(offline_note) <= 500);
