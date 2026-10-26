-- Email sign-ups from the "Be the first to get updates on new articles" form.
-- Anyone can join; only admins can read or remove the list.
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text,
  created_at timestamptz not null default now(),
  constraint newsletter_email_shape check (length(email) <= 254 and email ~* '^[^@ ]+@[^@ ]+[.][^@ ]+$')
);

create unique index if not exists newsletter_subscribers_email_key on public.newsletter_subscribers (lower(email));
create index if not exists newsletter_subscribers_created_idx on public.newsletter_subscribers (created_at desc);

alter table public.newsletter_subscribers enable row level security;

create policy "Anyone can join the newsletter" on public.newsletter_subscribers
  for insert to anon, authenticated with check (true);
create policy "Admins read the newsletter list" on public.newsletter_subscribers
  for select to authenticated using ((select private.is_admin()));
create policy "Admins remove newsletter sign-ups" on public.newsletter_subscribers
  for delete to authenticated using ((select private.is_admin()));
