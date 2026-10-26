-- Articles in any order, set from Admin → Articles → Arrange.
-- sort_order is empty for articles that haven't been placed. Those come first, newest first,
-- so a newly published article goes to the top until it's moved.

alter table public.articles add column if not exists sort_order integer;
create index if not exists articles_arranged_idx on public.articles (sort_order asc nulls first, published_at desc)
  where status = 'published';

-- Moving an article isn't editing it, so it leaves "last updated" alone.
create or replace trigger articles_touch before update on public.articles
  for each row when (old.sort_order is not distinct from new.sort_order)
  execute function private.touch_updated_at();

-- The list behind the home page, Articles, topics and search.
-- p_sort: 'arranged' (the order set in admin), 'newest' or 'oldest'.
-- `arranged` says whether any live article has been placed, so the page knows to offer that order.
create or replace function public.list_articles_v4(
  p_q text default null,
  p_topic text default null,
  p_sort text default 'arranged',
  p_limit int default 24,
  p_offset int default 0,
  p_exclude uuid default null
)
returns table (
  id uuid, title text, slug text, description text, published_at timestamptz,
  reading_minutes int, access public.access_level, featured boolean, topics jsonb,
  cover_image_url text, cover_alt text, accent text, cover_style text, text_colour text,
  arranged boolean, total_count bigint
)
language sql stable security invoker set search_path = ''
as $fn$
  select a.id, a.title, a.slug, a.description, a.published_at, a.reading_minutes, a.access, a.featured,
    coalesce((
      select jsonb_agg(jsonb_build_object('name', t.name, 'slug', t.slug) order by t.sort_order, t.name)
      from public.article_topics at join public.topics t on t.id = at.topic_id
      where at.article_id = a.id
    ), '[]'::jsonb) as topics,
    a.cover_image_url, a.cover_alt, a.accent, a.cover_style, a.text_colour,
    exists (
      select 1 from public.articles x
      where x.sort_order is not null and x.status = 'published' and x.published_at <= now()
    ) as arranged,
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
    case when coalesce(p_sort, 'arranged') not in ('oldest', 'newest') then a.sort_order end asc nulls first,
    a.published_at desc,
    a.id
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
$fn$;

-- The articles just before and after one, in the arranged order (Previous and Next under an article).
create or replace function public.adjacent_articles(p_article uuid)
returns table (direction text, title text, slug text, accent text, text_colour text)
language sql stable security invoker set search_path = ''
as $fn$
  with ordered as (
    select a.id, a.title, a.slug, a.accent, a.text_colour,
      row_number() over (order by a.sort_order asc nulls first, a.published_at desc, a.id) as n
    from public.articles a
    where a.status = 'published' and a.published_at <= now()
  ),
  me as (select o.n from ordered o where o.id = p_article)
  select case when o.n < me.n then 'previous' else 'next' end, o.title, o.slug, o.accent, o.text_colour
  from ordered o cross join me
  where o.n in (me.n - 1, me.n + 1);
$fn$;

-- Saves the order from admin: the ids top to bottom. Anything left out goes back to unplaced,
-- and an empty list puts everything back to newest first.
create or replace function public.set_article_order(p_ids uuid[])
returns void
language plpgsql security invoker set search_path = ''
as $fn$
begin
  if not coalesce((select private.is_admin()), false) then
    raise exception 'Only the site admin can arrange articles.' using errcode = '42501';
  end if;
  update public.articles a set sort_order = o.n::int
    from unnest(coalesce(p_ids, '{}'::uuid[])) with ordinality as o(id, n)
    where a.id = o.id and a.sort_order is distinct from o.n::int;
  update public.articles a set sort_order = null
    where a.sort_order is not null and not (a.id = any(coalesce(p_ids, '{}'::uuid[])));
end;
$fn$;

grant execute on function public.list_articles_v4(text, text, text, int, int, uuid) to anon, authenticated;
grant execute on function public.adjacent_articles(uuid) to anon, authenticated;
revoke execute on function public.set_article_order(uuid[]) from public, anon;
grant execute on function public.set_article_order(uuid[]) to authenticated;
