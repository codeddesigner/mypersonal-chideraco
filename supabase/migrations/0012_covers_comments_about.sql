-- 1. Article colours: a named colour or any #rrggbb picked on the colour wheel.
alter table public.articles drop constraint if exists articles_accent_check;
alter table public.articles add constraint articles_accent_check
  check (accent is null or accent in ('pool', 'leaf', 'lemon', 'blush', 'iris', 'saffron') or accent ~ '^#[0-9a-f]{6}$');

-- 2. The cover design chosen in the editor (null: picked from the slug).
alter table public.articles add column if not exists cover_style text
  check (cover_style is null or cover_style ~ '^[a-z]{2,20}$');

-- v3 listing functions also return the cover design.
create or replace function public.list_articles_v3(
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
  cover_image_url text, cover_alt text, accent text, cover_style text, total_count bigint
)
language sql stable security invoker set search_path = ''
as $fn$
  select a.id, a.title, a.slug, a.description, a.published_at, a.reading_minutes, a.access, a.featured,
    coalesce((
      select jsonb_agg(jsonb_build_object('name', t.name, 'slug', t.slug) order by t.sort_order, t.name)
      from public.article_topics at join public.topics t on t.id = at.topic_id
      where at.article_id = a.id
    ), '[]'::jsonb) as topics,
    a.cover_image_url, a.cover_alt, a.accent, a.cover_style,
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
$fn$;

create or replace function public.related_articles_v3(p_article uuid, p_limit int default 4)
returns table (
  id uuid, title text, slug text, description text, published_at timestamptz,
  reading_minutes int, access public.access_level, featured boolean, topics jsonb,
  cover_image_url text, cover_alt text, accent text, cover_style text, total_count bigint
)
language sql stable security invoker set search_path = ''
as $fn$
  with mine as (select topic_id from public.article_topics where article_id = p_article)
  select a.id, a.title, a.slug, a.description, a.published_at, a.reading_minutes, a.access, a.featured,
    coalesce((
      select jsonb_agg(jsonb_build_object('name', t.name, 'slug', t.slug) order by t.sort_order, t.name)
      from public.article_topics at join public.topics t on t.id = at.topic_id
      where at.article_id = a.id
    ), '[]'::jsonb) as topics,
    a.cover_image_url, a.cover_alt, a.accent, a.cover_style,
    0::bigint as total_count
  from public.articles a
  where a.status = 'published' and a.published_at <= now() and a.id <> p_article
  order by
    (select count(*) from public.article_topics at where at.article_id = a.id and at.topic_id in (select topic_id from mine)) desc,
    a.published_at desc
  limit least(greatest(p_limit, 1), 12);
$fn$;

grant execute on function public.list_articles_v3(text, text, text, int, int, uuid) to anon, authenticated;
grant execute on function public.related_articles_v3(uuid, int) to anon, authenticated;

-- 3. Comments from signed-in readers. Readers see the comments on articles they can read;
-- the author and admins can delete them. The name is copied from the profile when posting.
create table if not exists public.article_comments (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  author_name text not null default '' check (char_length(author_name) <= 80),
  by_admin boolean not null default false,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists article_comments_article_idx on public.article_comments (article_id, created_at);
create index if not exists article_comments_user_idx on public.article_comments (user_id, created_at);
alter table public.article_comments enable row level security;

create or replace function private.article_comments_before_insert()
returns trigger language plpgsql security definer set search_path = ''
as $fn$
declare
  v_name text;
  v_role public.user_role;
begin
  if current_user in ('anon', 'authenticated') then
    new.user_id := auth.uid();
  end if;
  select nullif(btrim(p.display_name), ''), p.role into v_name, v_role from public.profiles p where p.id = new.user_id;
  new.author_name := left(coalesce(v_name, 'Reader'), 80);
  new.by_admin := coalesce(v_role = 'admin', false);
  new.body := btrim(new.body);
  new.created_at := now();
  if (select count(*) from public.article_comments c where c.user_id = new.user_id and c.created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'too_many_comments' using errcode = 'P0001';
  end if;
  return new;
end;
$fn$;

drop trigger if exists article_comments_before_insert on public.article_comments;
create trigger article_comments_before_insert before insert on public.article_comments
  for each row execute function private.article_comments_before_insert();

drop policy if exists "Readers of the article see its comments" on public.article_comments;
create policy "Readers of the article see its comments" on public.article_comments for select to anon, authenticated
  using (private.can_read_article(article_id));
drop policy if exists "Signed-in readers comment" on public.article_comments;
create policy "Signed-in readers comment" on public.article_comments for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.is_active_reader()) and private.can_read_article(article_id));
drop policy if exists "Authors and admins delete comments" on public.article_comments;
create policy "Authors and admins delete comments" on public.article_comments for delete to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

-- 4. New accounts take their name from Google when they sign up with it.
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $fn$
begin
  insert into public.profiles (id, email, role, display_name)
  values (
    new.id,
    lower(new.email),
    case when exists (select 1 from private.admin_emails a where a.email = lower(new.email))
      then 'admin'::public.user_role else 'reader'::public.user_role end,
    nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), 80), '')
  );
  return new;
end;
$fn$;

-- 5. The opening of "What I do" on the About page.
alter table public.site_settings
  add column if not exists about_statement text check (about_statement is null or char_length(about_statement) <= 300),
  add column if not exists about_credential text check (about_credential is null or char_length(about_credential) <= 160),
  add column if not exists about_figures jsonb not null default '[]'::jsonb
    check (jsonb_typeof(about_figures) = 'array' and pg_column_size(about_figures) < 20000);
