-- Move the search helper out of the public API; list_articles calls the private copy.
create or replace function private.search_article_ids(q text)
returns setof uuid language sql stable security definer set search_path = ''
as $$
  select a.id
  from public.articles a
  left join public.article_bodies b on b.article_id = a.id
  where a.status = 'published' and a.published_at <= now()
    and char_length(btrim(q)) > 0
    and (
      to_tsvector('english', a.title || ' ' || a.description || ' ' || a.preview || ' ' || coalesce(b.body, ''))
        @@ websearch_to_tsquery('english', q)
      or position(lower(btrim(q)) in lower(a.title)) > 0
      or position(lower(btrim(q)) in lower(a.description)) > 0
    );
$$;
revoke execute on function private.search_article_ids(text) from public;
grant execute on function private.search_article_ids(text) to anon, authenticated;

create or replace function public.list_articles(
  p_q text default null,
  p_topic text default null,
  p_sort text default 'newest',
  p_limit int default 24,
  p_offset int default 0,
  p_exclude uuid default null
)
returns table (
  id uuid, title text, slug text, description text, published_at timestamptz,
  reading_minutes int, access public.access_level, featured boolean, topics jsonb, total_count bigint
)
language sql stable security invoker set search_path = ''
as $$
  select a.id, a.title, a.slug, a.description, a.published_at, a.reading_minutes, a.access, a.featured,
    coalesce((
      select jsonb_agg(jsonb_build_object('name', t.name, 'slug', t.slug) order by t.sort_order, t.name)
      from public.article_topics at join public.topics t on t.id = at.topic_id
      where at.article_id = a.id
    ), '[]'::jsonb) as topics,
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

-- The old public copy is no longer callable through the API.
revoke execute on function public.search_article_ids(text) from anon, authenticated;

create index if not exists events_user_idx on public.events (user_id);
create index if not exists saved_articles_article_idx on public.saved_articles (article_id);
