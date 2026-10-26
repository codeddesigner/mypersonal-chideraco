-- Site copy that the owner edits from Admin → Site content.
-- Each is optional; when empty the site falls back to the text in lib/content.ts.
alter table public.site_settings
  add column if not exists hero_lines text,
  add column if not exists portrait_url text,
  add column if not exists portrait_alt text,
  add column if not exists footer_about text,
  add column if not exists newsletter_heading text;

alter table public.site_settings
  add constraint site_settings_hero_lines_length check (hero_lines is null or char_length(hero_lines) <= 400),
  add constraint site_settings_portrait_url_https check (portrait_url is null or portrait_url like 'https://%'),
  add constraint site_settings_portrait_alt_length check (portrait_alt is null or char_length(portrait_alt) <= 200),
  add constraint site_settings_footer_about_length check (footer_about is null or char_length(footer_about) <= 600),
  add constraint site_settings_newsletter_heading_length check (newsletter_heading is null or char_length(newsletter_heading) <= 300);
