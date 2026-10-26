-- Cover images and a per-essay colour for the editorial panels.
alter table public.articles
  add column if not exists cover_image_url text check (cover_image_url is null or cover_image_url ~ '^https://'),
  add column if not exists cover_alt text not null default '' check (char_length(cover_alt) <= 300),
  add column if not exists accent text check (accent is null or accent in ('pool', 'leaf', 'lemon', 'blush', 'iris', 'saffron'));

-- v2 listing functions also return the cover and colour.
create or replace function public.list_articles_v2(
  p_q text default null,
  p_topic text default null,
  p_sort text default 'newest',
  p_limit int default 24,
  p_offset int default 0,
  p_exclude uuid default null
)
returns table (
  id uuid, title text, slug text, description text, published_at timestamptz,
  reading_minutes int, access public.access_level, featured boolean, topics jsonb,
  cover_image_url text, cover_alt text, accent text, total_count bigint
)
language sql stable security invoker set search_path = ''
as $$
  select a.id, a.title, a.slug, a.description, a.published_at, a.reading_minutes, a.access, a.featured,
    coalesce((
      select jsonb_agg(jsonb_build_object('name', t.name, 'slug', t.slug) order by t.sort_order, t.name)
      from public.article_topics at join public.topics t on t.id = at.topic_id
      where at.article_id = a.id
    ), '[]'::jsonb) as topics,
    a.cover_image_url, a.cover_alt, a.accent,
    count(*) over () as total_count
  from public.articles a
  where a.status = 'published' and a.published_at <= now()
    and (p_exclude is null or a.id <> p_exclude)
    and (p_q is null or btrim(p_q) = '' or a.id in (select private.search_article_ids(p_q)))
    and (p_topic is null or p_topic = '' or exists (
      select 1 from public.article_topics at join public.topics t on t.id = at.topic_id
      where at.article_id = a.id and t.slug = p_topic
    ))
  order by
    case when p_sort = 'oldest' then a.published_at end asc,
    a.published_at desc
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
$$;

create or replace function public.related_articles_v2(p_article uuid, p_limit int default 4)
returns table (
  id uuid, title text, slug text, description text, published_at timestamptz,
  reading_minutes int, access public.access_level, featured boolean, topics jsonb,
  cover_image_url text, cover_alt text, accent text, total_count bigint
)
language sql stable security invoker set search_path = ''
as $$
  with mine as (select topic_id from public.article_topics where article_id = p_article)
  select a.id, a.title, a.slug, a.description, a.published_at, a.reading_minutes, a.access, a.featured,
    coalesce((
      select jsonb_agg(jsonb_build_object('name', t.name, 'slug', t.slug) order by t.sort_order, t.name)
      from public.article_topics at join public.topics t on t.id = at.topic_id
      where at.article_id = a.id
    ), '[]'::jsonb) as topics,
    a.cover_image_url, a.cover_alt, a.accent,
    0::bigint as total_count
  from public.articles a
  where a.status = 'published' and a.published_at <= now() and a.id <> p_article
  order by
    (select count(*) from public.article_topics at where at.article_id = a.id and at.topic_id in (select topic_id from mine)) desc,
    a.published_at desc
  limit least(greatest(p_limit, 1), 12);
$$;
