-- Contact and press details, edited in Admin → Settings.
-- Each one is optional; the site only shows a link once it is filled in.
alter table public.site_settings
  add column if not exists booking_url text,
  add column if not exists contact_email text,
  add column if not exists press_kit_url text;

alter table public.site_settings
  add constraint site_settings_booking_url_https check (booking_url is null or booking_url ~* '^https://'),
  add constraint site_settings_press_kit_url_https check (press_kit_url is null or press_kit_url ~* '^https://'),
  add constraint site_settings_contact_email_shape check (contact_email is null or contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');
