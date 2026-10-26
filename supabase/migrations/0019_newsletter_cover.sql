-- A cover at the top of each newsletter, like an article's: the generated artwork, an uploaded image, or none.
-- cover_seed picks the artwork's details; a newsletter made from an article uses the article's address, so the
-- email shows exactly the article's artwork. Without one, the subject (as an address) is used.

alter table public.newsletter_campaigns
  add column if not exists cover_mode text not null default 'none',
  add column if not exists cover_image_url text,
  add column if not exists cover_alt text not null default '',
  add column if not exists cover_style text,
  add column if not exists accent text,
  add column if not exists cover_seed text;

alter table public.newsletter_campaigns
  drop constraint if exists newsletter_campaigns_cover_mode_check,
  add constraint newsletter_campaigns_cover_mode_check check (cover_mode in ('none', 'art', 'image')),
  drop constraint if exists newsletter_campaigns_cover_image_check,
  add constraint newsletter_campaigns_cover_image_check
    check (cover_image_url is null or (cover_image_url ~ '^https://' and length(cover_image_url) <= 1000)),
  drop constraint if exists newsletter_campaigns_cover_text_check,
  add constraint newsletter_campaigns_cover_text_check
    check (length(cover_alt) <= 300 and length(coalesce(cover_style, '')) <= 40
      and length(coalesce(accent, '')) <= 40 and length(coalesce(cover_seed, '')) <= 120);
