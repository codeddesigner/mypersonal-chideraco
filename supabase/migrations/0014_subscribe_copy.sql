-- The Subscribe page's words, edited under Admin → Site content. Empty means the built-in wording.
alter table public.site_settings
  add column if not exists subscribe_heading text check (subscribe_heading is null or char_length(subscribe_heading) <= 60),
  add column if not exists subscribe_intro text check (subscribe_intro is null or char_length(subscribe_intro) <= 300),
  add column if not exists subscribe_art_line text check (subscribe_art_line is null or char_length(subscribe_art_line) <= 140);
