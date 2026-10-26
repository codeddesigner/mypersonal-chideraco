-- The colour of the text on an article's header (and on the featured panel and the previous/next links).
-- Null means automatic: dark ink or white, whichever reads better on the article's colour.
alter table public.articles add column if not exists text_colour text
  check (text_colour is null or text_colour ~ '^#[0-9a-f]{6}$');
