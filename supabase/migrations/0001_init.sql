-- Chidera.com — initial schema
-- Articles metadata is public once published. Full article bodies live in a
-- separate table whose row-level security decides who may read them, so
-- protected text never leaves the database for a reader without access.

create schema if not exists private;
grant usage on schema private to anon, authenticated;

-- Types --------------------------------------------------------------------
create type public.article_status as enum ('draft', 'published', 'archived');
create type public.access_level as enum ('public', 'members', 'subscribers');
create type public.user_role as enum ('reader', 'admin');
create type public.account_status as enum ('active', 'suspended');
create type public.subscription_status as enum ('active', 'trialing', 'past_due', 'canceled', 'expired');

-- Users ----------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text check (char_length(display_name) <= 80),
  role public.user_role not null default 'reader',
  status public.account_status not null default 'active',
  created_at timestamptz not null default now()
);

-- Emails listed here become administrators when they sign up.
create table private.admin_emails (
  email text primary key check (email = lower(email))
);

-- Topics ---------------------------------------------------------------------
create table public.topics (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 60),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Articles -------------------------------------------------------------------
create table public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 300),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '' check (char_length(description) <= 600),
  preview text not null default '',
  author text not null default 'Chidera Nwanyemike',
  status public.article_status not null default 'draft',
  published_at timestamptz,
  reading_minutes int not null default 1 check (reading_minutes > 0),
  featured boolean not null default false,
  access public.access_level not null default 'members',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint published_has_date check (status <> 'published' or published_at is not null)
);
create unique index articles_single_featured on public.articles ((true)) where featured;
create index articles_published_idx on public.articles (published_at desc) where status = 'published';

create table public.article_bodies (
  article_id uuid primary key references public.articles (id) on delete cascade,
  body text not null default '',
  updated_at timestamptz not null default now()
);

create table public.article_topics (
  article_id uuid not null references public.articles (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  primary key (article_id, topic_id)
);
create index article_topics_topic_idx on public.article_topics (topic_id);

-- Subscriptions (kept separate from accounts) --------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.subscription_status not null default 'active',
  plan text not null default 'standard',
  started_at timestamptz not null default now(),
  current_period_end timestamptz,
  provider text not null default 'manual',
  provider_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_user_idx on public.subscriptions (user_id);

-- Saved articles (later-stage feature; table reserved) -----------------------
create table public.saved_articles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  article_id uuid not null references public.articles (id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (user_id, article_id)
);

-- Site settings (single row) -------------------------------------------------
create table public.site_settings (
  id boolean primary key default true check (id),
  subscriptions_enabled boolean not null default false,
  plan_name text not null default 'Reader subscription',
  price_amount numeric(10, 2) not null default 5 check (price_amount >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  billing_interval text not null default 'month' check (billing_interval in ('month', 'year')),
  billing_provider text not null default 'manual' check (billing_provider in ('manual', 'paystack', 'stripe', 'flutterwave', 'other')),
  checkout_url text check (checkout_url is null or checkout_url ~ '^https://'),
  subscribe_note text not null default '',
  about_body text not null default '',
  social_links jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.site_settings (id) values (true);

-- Analytics events -----------------------------------------------------------
create table public.events (
  id bigint generated always as identity primary key,
  name text not null check (name in (
    'article_viewed', 'read_more_clicked', 'signup_initiated', 'account_created',
    'signin_completed', 'subscription_initiated', 'subscription_completed',
    'search_performed', 'topic_selected')),
  path text check (char_length(path) <= 300),
  article_id uuid references public.articles (id) on delete set null,
  topic text check (char_length(topic) <= 100),
  query text check (char_length(query) <= 200),
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index events_created_idx on public.events (created_at desc);
create index events_article_idx on public.events (article_id);

-- Helper functions (private schema: not callable through the API) -----------
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.status = 'active'
      and u.email_confirmed_at is not null
  );
$$;

create or replace function private.is_active_reader()
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'active');
$$;

create or replace function private.has_active_subscription()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = auth.uid()
      and s.status in ('active', 'trialing')
      and (s.current_period_end is null or s.current_period_end > now())
  );
$$;

-- The single source of truth for "may this person read the full article?"
create or replace function private.can_read_article(target uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.is_admin() or exists (
    select 1 from public.articles a
    where a.id = target
      and a.status = 'published'
      and a.published_at <= now()
      and (
        a.access = 'public'
        or (private.is_active_reader() and (
          a.access = 'members'
          or (a.access = 'subscribers' and (
            not coalesce((select s.subscriptions_enabled from public.site_settings s), false)
            or private.has_active_subscription()
          ))
        ))
      )
  );
$$;

grant execute on function private.is_admin() to anon, authenticated;
grant execute on function private.is_active_reader() to anon, authenticated;
grant execute on function private.has_active_subscription() to anon, authenticated;
grant execute on function private.can_read_article(uuid) to anon, authenticated;

-- Triggers -------------------------------------------------------------------
create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger articles_touch before update on public.articles
  for each row execute function private.touch_updated_at();
create trigger article_bodies_touch before update on public.article_bodies
  for each row execute function private.touch_updated_at();
create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function private.touch_updated_at();
create trigger site_settings_touch before update on public.site_settings
  for each row execute function private.touch_updated_at();

-- Publishing without a date publishes now; featuring one article un-features the rest.
create or replace function private.articles_before_write()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at = now();
  end if;
  if new.featured and (tg_op = 'INSERT' or not old.featured) then
    update public.articles set featured = false where featured and id <> new.id;
  end if;
  return new;
end;
$$;
create trigger articles_before_write before insert or update on public.articles
  for each row execute function private.articles_before_write();

-- Reading time from the body (about 230 words per minute).
create or replace function private.article_bodies_reading_time()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  words int;
begin
  words := coalesce(array_length(regexp_split_to_array(btrim(new.body), '\s+'), 1), 0);
  update public.articles
    set reading_minutes = greatest(1, ceil(words / 230.0)::int)
    where id = new.article_id;
  return new;
end;
$$;
create trigger article_bodies_reading_time after insert or update of body on public.article_bodies
  for each row execute function private.article_bodies_reading_time();

-- Create a profile for every new account.
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    lower(new.email),
    case when exists (select 1 from private.admin_emails a where a.email = lower(new.email))
      then 'admin'::public.user_role else 'reader'::public.user_role end
  );
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.handle_user_email_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles set email = lower(new.email) where id = new.id;
  return new;
end;
$$;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row execute function private.handle_user_email_change();

-- Readers may edit their own display name, but only admins change role, status or email.
create or replace function private.profiles_guard()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') and not private.is_admin() then
    if new.role is distinct from old.role
      or new.status is distinct from old.status
      or new.email is distinct from old.email
      or new.id is distinct from old.id then
      raise exception 'Not allowed to change account role, status or email';
    end if;
  end if;
  return new;
end;
$$;
create trigger profiles_guard before update on public.profiles
  for each row execute function private.profiles_guard();

-- Row-level security ---------------------------------------------------------
alter table public.profiles enable row level security;
alter table private.admin_emails enable row level security;
alter table public.topics enable row level security;
alter table public.articles enable row level security;
alter table public.article_bodies enable row level security;
alter table public.article_topics enable row level security;
alter table public.subscriptions enable row level security;
alter table public.saved_articles enable row level security;
alter table public.site_settings enable row level security;
alter table public.events enable row level security;

-- profiles
create policy "Read own profile or admin" on public.profiles for select
  to authenticated using (id = (select auth.uid()) or (select private.is_admin()));
create policy "Update own profile or admin" on public.profiles for update
  to authenticated using (id = (select auth.uid()) or (select private.is_admin()))
  with check (id = (select auth.uid()) or (select private.is_admin()));

-- topics
create policy "Topics are public" on public.topics for select to anon, authenticated using (true);
create policy "Admins insert topics" on public.topics for insert to authenticated with check ((select private.is_admin()));
create policy "Admins update topics" on public.topics for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins delete topics" on public.topics for delete to authenticated using ((select private.is_admin()));

-- articles (metadata + public preview)
create policy "Published articles are public" on public.articles for select to anon, authenticated
  using ((status = 'published' and published_at <= now()) or (select private.is_admin()));
create policy "Admins insert articles" on public.articles for insert to authenticated with check ((select private.is_admin()));
create policy "Admins update articles" on public.articles for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins delete articles" on public.articles for delete to authenticated using ((select private.is_admin()));

-- article bodies (the protected text)
create policy "Readers with access read bodies" on public.article_bodies for select to anon, authenticated
  using (private.can_read_article(article_id));
create policy "Admins insert bodies" on public.article_bodies for insert to authenticated with check ((select private.is_admin()));
create policy "Admins update bodies" on public.article_bodies for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins delete bodies" on public.article_bodies for delete to authenticated using ((select private.is_admin()));

-- article topics (visible when the article is visible)
create policy "Article topics follow article visibility" on public.article_topics for select to anon, authenticated
  using (exists (select 1 from public.articles a where a.id = article_id));
create policy "Admins insert article topics" on public.article_topics for insert to authenticated with check ((select private.is_admin()));
create policy "Admins delete article topics" on public.article_topics for delete to authenticated using ((select private.is_admin()));

-- subscriptions
create policy "Read own subscription or admin" on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "Admins insert subscriptions" on public.subscriptions for insert to authenticated with check ((select private.is_admin()));
create policy "Admins update subscriptions" on public.subscriptions for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins delete subscriptions" on public.subscriptions for delete to authenticated using ((select private.is_admin()));

-- saved articles
create policy "Readers manage own saved articles" on public.saved_articles for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- site settings
create policy "Settings are public" on public.site_settings for select to anon, authenticated using (true);
create policy "Admins update settings" on public.site_settings for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- events
create policy "Anyone records events" on public.events for insert to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));
create policy "Admins read events" on public.events for select to authenticated using ((select private.is_admin()));

-- Read helpers (security invoker: row-level security still applies) ---------
create or replace function public.search_article_ids(q text)
returns setof uuid language sql stable security definer set search_path = ''
as $$
  -- Matches titles, descriptions and the article text, but returns only ids of
  -- published articles; the text itself never leaves the database.
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
revoke execute on function public.search_article_ids(text) from public;
grant execute on function public.search_article_ids(text) to anon, authenticated;

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
    and (p_q is null or btrim(p_q) = '' or a.id in (select public.search_article_ids(p_q)))
    and (p_topic is null or p_topic = '' or exists (
      select 1 from public.article_topics at join public.topics t on t.id = at.topic_id
      where at.article_id = a.id and t.slug = p_topic
    ))
  order by
    case when p_sort = 'oldest' then a.published_at end asc,
    a.published_at desc
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
$$;

create or replace function public.related_articles(p_article uuid, p_limit int default 4)
returns table (
  id uuid, title text, slug text, description text, published_at timestamptz,
  reading_minutes int, access public.access_level, featured boolean, topics jsonb, total_count bigint
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
    0::bigint as total_count
  from public.articles a
  where a.status = 'published' and a.published_at <= now() and a.id <> p_article
  order by
    (select count(*) from public.article_topics at where at.article_id = a.id and at.topic_id in (select topic_id from mine)) desc,
    a.published_at desc
  limit least(greatest(p_limit, 1), 12);
$$;

create or replace function public.topic_counts()
returns table (id uuid, name text, slug text, sort_order int, article_count bigint)
language sql stable security invoker set search_path = ''
as $$
  select t.id, t.name, t.slug, t.sort_order,
    (select count(*) from public.article_topics at
       join public.articles a on a.id = at.article_id
       where at.topic_id = t.id and a.status = 'published' and a.published_at <= now()) as article_count
  from public.topics t
  order by t.sort_order, t.name;
$$;

create or replace function public.event_summary(p_days int default 30)
returns table (name text, total bigint)
language sql stable security invoker set search_path = ''
as $$
  select e.name, count(*) from public.events e
  where e.created_at > now() - make_interval(days => p_days)
  group by e.name order by 2 desc;
$$;

create or replace function public.top_articles(p_days int default 30, p_limit int default 8)
returns table (article_id uuid, title text, slug text, views bigint, read_more bigint)
language sql stable security invoker set search_path = ''
as $$
  select a.id, a.title, a.slug,
    count(*) filter (where e.name = 'article_viewed'),
    count(*) filter (where e.name = 'read_more_clicked')
  from public.events e join public.articles a on a.id = e.article_id
  where e.created_at > now() - make_interval(days => p_days)
  group by a.id, a.title, a.slug
  order by 4 desc, 5 desc
  limit p_limit;
$$;

-- Images for articles ---------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('article-images', 'article-images', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create policy "Admins upload article images" on storage.objects for insert to authenticated
  with check (bucket_id = 'article-images' and (select private.is_admin()));
create policy "Admins update article images" on storage.objects for update to authenticated
  using (bucket_id = 'article-images' and (select private.is_admin()));
create policy "Admins delete article images" on storage.objects for delete to authenticated
  using (bucket_id = 'article-images' and (select private.is_admin()));
