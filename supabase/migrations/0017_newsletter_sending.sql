-- Newsletters written and sent from Admin → Newsletter.
--
-- Subscribers get a status (active or unsubscribed) and a private unsubscribe link.
-- Each newsletter is a campaign. Sending snapshots the active subscribers into a delivery queue, and the admin
-- page works through the queue in small batches. Every batch carries a key that is reused if the batch has to be
-- retried, so the email provider can recognise a repeat and nobody gets the same newsletter twice.

/* Subscribers -------------------------------------------------------------------------------------------- */

alter table public.newsletter_subscribers add column if not exists status text not null default 'active';
alter table public.newsletter_subscribers add column if not exists unsubscribed_at timestamptz;
alter table public.newsletter_subscribers add column if not exists unsubscribe_token uuid not null default gen_random_uuid();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'newsletter_subscribers_status_check') then
    alter table public.newsletter_subscribers
      add constraint newsletter_subscribers_status_check check (status in ('active', 'unsubscribed'));
  end if;
end;
$$;

create unique index if not exists newsletter_subscribers_token_key on public.newsletter_subscribers (unsubscribe_token);
create index if not exists newsletter_subscribers_status_idx on public.newsletter_subscribers (status, created_at desc);

-- Joining now goes through newsletter_subscribe(), which checks the address and handles people who come back.
revoke insert on public.newsletter_subscribers from anon, authenticated;

create policy "Admins update newsletter sign-ups" on public.newsletter_subscribers
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- The sign-up form. Returns 'joined', 'rejoined' (was unsubscribed, now active again), 'already' or 'invalid'.
create or replace function public.newsletter_subscribe(p_email text, p_source text default null)
returns text
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_status text;
begin
  if length(v_email) > 254 or v_email !~* '^[^@ ]+@[^@ ]+[.][^@ ]+$' then
    return 'invalid';
  end if;

  select s.status into v_status from public.newsletter_subscribers s where lower(s.email) = v_email;
  if v_status is null then
    insert into public.newsletter_subscribers (email, source)
      values (v_email, nullif(left(btrim(coalesce(p_source, '')), 40), ''))
      on conflict do nothing;
    return case when found then 'joined' else 'already' end;
  end if;

  if v_status = 'unsubscribed' then
    -- A fresh unsubscribe link, so an old one can't undo this.
    update public.newsletter_subscribers s
      set status = 'active', unsubscribed_at = null, unsubscribe_token = gen_random_uuid()
      where lower(s.email) = v_email;
    return 'rejoined';
  end if;
  return 'already';
end;
$fn$;

-- The unsubscribe page: the address it's for, partly hidden, and whether it's still subscribed.
create or replace function public.newsletter_lookup(p_token uuid)
returns table (masked_email text, status text)
language sql stable security definer set search_path = ''
as $fn$
  select
    left(s.email, 1) || repeat('•', greatest(least(length(split_part(s.email, '@', 1)) - 1, 6), 2)) || '@' || split_part(s.email, '@', 2),
    s.status
  from public.newsletter_subscribers s
  where s.unsubscribe_token = p_token;
$fn$;

-- Unsubscribe link and one-click unsubscribe. Returns 'done', 'already' or 'unknown'.
create or replace function public.newsletter_unsubscribe(p_token uuid)
returns text
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_status text;
begin
  select s.status into v_status from public.newsletter_subscribers s where s.unsubscribe_token = p_token for update;
  if v_status is null then return 'unknown'; end if;
  if v_status = 'unsubscribed' then return 'already'; end if;
  update public.newsletter_subscribers s
    set status = 'unsubscribed', unsubscribed_at = now()
    where s.unsubscribe_token = p_token;
  return 'done';
end;
$fn$;

/* Newsletters ------------------------------------------------------------------------------------------- */

create table if not exists public.newsletter_campaigns (
  id uuid primary key default gen_random_uuid(),
  subject text not null default '' check (length(subject) <= 200),
  preheader text not null default '' check (length(preheader) <= 200),
  body text not null default '' check (length(body) <= 100000),
  status text not null default 'draft' check (status in ('draft', 'sending', 'sent')),
  total integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  skipped_count integer not null default 0,
  test_sent_to text,
  test_sent_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists newsletter_campaigns_created_idx on public.newsletter_campaigns (created_at desc);

create or replace trigger newsletter_campaigns_touch before update on public.newsletter_campaigns
  for each row execute function private.touch_updated_at();

alter table public.newsletter_campaigns enable row level security;

create policy "Admins read newsletters" on public.newsletter_campaigns
  for select to authenticated using ((select private.is_admin()));
create policy "Admins write newsletters" on public.newsletter_campaigns
  for insert to authenticated with check ((select private.is_admin()) and status = 'draft');
-- Once sending starts the words are locked, so a retried batch is exactly what was sent before.
create policy "Admins edit draft newsletters" on public.newsletter_campaigns
  for update to authenticated
  using ((select private.is_admin()) and status = 'draft')
  with check ((select private.is_admin()) and status = 'draft');
create policy "Admins delete draft newsletters" on public.newsletter_campaigns
  for delete to authenticated using ((select private.is_admin()) and status = 'draft');

-- One row per person a newsletter goes to.
create table if not exists public.newsletter_deliveries (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references public.newsletter_campaigns (id) on delete cascade,
  subscriber_id uuid references public.newsletter_subscribers (id) on delete set null,
  email text not null,
  unsubscribe_token uuid not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  batch_key uuid,
  attempts integer not null default 0,
  provider_id text,
  error text,
  claimed_at timestamptz,
  sent_at timestamptz
);

create unique index if not exists newsletter_deliveries_once on public.newsletter_deliveries (campaign_id, lower(email));
create index if not exists newsletter_deliveries_queue on public.newsletter_deliveries (campaign_id, status, id);
create index if not exists newsletter_deliveries_batch on public.newsletter_deliveries (campaign_id, batch_key);

alter table public.newsletter_deliveries enable row level security;
revoke all on public.newsletter_deliveries from anon;

-- Admins can read the queue; it only changes through the functions below.
create policy "Admins read newsletter deliveries" on public.newsletter_deliveries
  for select to authenticated using ((select private.is_admin()));

-- Counts for one newsletter. Marks it sent once nothing is waiting.
create or replace function public.newsletter_progress(p_campaign uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $fn$
declare
  v jsonb;
  v_waiting int;
begin
  if not coalesce((select private.is_admin()), false) then
    raise exception 'Only the site admin can send newsletters.' using errcode = '42501';
  end if;

  select
    count(*) filter (where d.status in ('pending', 'sending')),
    jsonb_build_object(
      'total', count(*),
      'sent', count(*) filter (where d.status = 'sent'),
      'failed', count(*) filter (where d.status = 'failed'),
      'skipped', count(*) filter (where d.status = 'skipped'),
      'waiting', count(*) filter (where d.status in ('pending', 'sending'))
    )
  into v_waiting, v
  from public.newsletter_deliveries d
  where d.campaign_id = p_campaign;

  update public.newsletter_campaigns c
    set total = (v ->> 'total')::int,
        sent_count = (v ->> 'sent')::int,
        failed_count = (v ->> 'failed')::int,
        skipped_count = (v ->> 'skipped')::int,
        status = case when c.status = 'sending' and v_waiting = 0 then 'sent' else c.status end,
        finished_at = case when c.status = 'sending' and v_waiting = 0 then now() else c.finished_at end
    where c.id = p_campaign and c.status <> 'draft';

  return v || jsonb_build_object('status', (select c.status from public.newsletter_campaigns c where c.id = p_campaign));
end;
$fn$;

-- Send button: locks the newsletter and queues everyone who is subscribed right now.
-- Only a draft can start, so pressing Send twice can't queue the list twice. Returns how many were queued.
create or replace function public.newsletter_start(p_campaign uuid)
returns integer
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_status text;
  v_subject text;
  v_body text;
  v_count int;
begin
  if not coalesce((select private.is_admin()), false) then
    raise exception 'Only the site admin can send newsletters.' using errcode = '42501';
  end if;

  select c.status, c.subject, c.body into v_status, v_subject, v_body
    from public.newsletter_campaigns c where c.id = p_campaign for update;
  if v_status is null then
    raise exception 'That newsletter doesn’t exist.' using errcode = 'P0002';
  end if;
  if v_status <> 'draft' then
    raise exception 'This newsletter has already been sent.' using errcode = 'P0001';
  end if;
  if btrim(v_subject) = '' or btrim(v_body) = '' then
    raise exception 'Add a subject and a message before sending.' using errcode = 'P0001';
  end if;

  insert into public.newsletter_deliveries (campaign_id, subscriber_id, email, unsubscribe_token)
    select p_campaign, s.id, s.email, s.unsubscribe_token
    from public.newsletter_subscribers s
    where s.status = 'active'
    order by s.created_at
    on conflict do nothing;
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'There are no active subscribers to send to yet.' using errcode = 'P0001';
  end if;

  update public.newsletter_campaigns c
    set status = 'sending', started_at = now(), total = v_count, sent_count = 0, failed_count = 0, skipped_count = 0
    where c.id = p_campaign;
  return v_count;
end;
$fn$;

-- Hands out the next batch to send. A batch that was handed out but never confirmed (the page closed, the
-- provider timed out) comes back first, with the same key, so the provider sees a repeat and doesn't send it again.
create or replace function public.newsletter_claim(p_campaign uuid, p_limit integer default 50)
returns table (delivery_id bigint, to_email text, token uuid, batch uuid)
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_key uuid;
begin
  if not coalesce((select private.is_admin()), false) then
    raise exception 'Only the site admin can send newsletters.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.newsletter_campaigns c where c.id = p_campaign and c.status = 'sending') then
    return;
  end if;

  -- People who unsubscribed (or were removed) after the send started are left out.
  update public.newsletter_deliveries d
    set status = 'skipped', error = 'Unsubscribed before it was sent'
    where d.campaign_id = p_campaign and d.status = 'pending'
      and (d.subscriber_id is null
        or exists (select 1 from public.newsletter_subscribers s where s.id = d.subscriber_id and s.status <> 'active'));

  select d.batch_key into v_key
    from public.newsletter_deliveries d
    where d.campaign_id = p_campaign and d.status = 'sending' and d.claimed_at < now() - interval '2 minutes'
    order by d.claimed_at, d.id
    limit 1
    for update skip locked;

  if v_key is not null then
    return query
      with again as (
        update public.newsletter_deliveries d
          set claimed_at = now(), attempts = d.attempts + 1
          where d.campaign_id = p_campaign and d.batch_key = v_key and d.status = 'sending'
          returning d.id, d.email, d.unsubscribe_token, d.batch_key
      )
      select again.id, again.email, again.unsubscribe_token, again.batch_key from again order by again.id;
    return;
  end if;

  v_key := gen_random_uuid();
  return query
    with picked as (
      select d.id from public.newsletter_deliveries d
      where d.campaign_id = p_campaign and d.status = 'pending'
      order by d.id
      limit least(greatest(coalesce(p_limit, 50), 1), 100)
      for update skip locked
    )
    , claimed as (
      update public.newsletter_deliveries d
        set status = 'sending', batch_key = v_key, claimed_at = now(), attempts = d.attempts + 1
        from picked
        where d.id = picked.id
        returning d.id, d.email, d.unsubscribe_token, d.batch_key
    )
    select claimed.id, claimed.email, claimed.unsubscribe_token, claimed.batch_key from claimed order by claimed.id;
end;
$fn$;

-- Records what happened to a batch, then returns the newsletter's counts.
--   'sent'   the provider accepted it; p_provider_ids are its message ids, in the batch's order (by id)
--   'failed' the provider turned these addresses down for good; p_error says why
--   'retry'  nothing is known to have been sent; send the same batch again with the same key
--   'split'  the provider rejected the whole batch because of one address; send each one on its own
create or replace function public.newsletter_settle(
  p_campaign uuid,
  p_batch uuid,
  p_outcome text,
  p_provider_ids text[] default null,
  p_error text default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $fn$
begin
  if not coalesce((select private.is_admin()), false) then
    raise exception 'Only the site admin can send newsletters.' using errcode = '42501';
  end if;

  if p_outcome = 'sent' then
    with ordered as (
      select d.id, row_number() over (order by d.id) as n
      from public.newsletter_deliveries d
      where d.campaign_id = p_campaign and d.batch_key = p_batch and d.status = 'sending'
    )
    update public.newsletter_deliveries d
      set status = 'sent', sent_at = now(), error = null, provider_id = p_provider_ids[ordered.n::int]
      from ordered
      where d.id = ordered.id;
  elsif p_outcome = 'failed' then
    update public.newsletter_deliveries d
      set status = 'failed', error = left(coalesce(p_error, 'The email provider turned this address down.'), 300)
      where d.campaign_id = p_campaign and d.batch_key = p_batch and d.status = 'sending';
  elsif p_outcome = 'retry' then
    update public.newsletter_deliveries d
      set claimed_at = 'epoch', error = left(p_error, 300)
      where d.campaign_id = p_campaign and d.batch_key = p_batch and d.status = 'sending';
  elsif p_outcome = 'split' then
    update public.newsletter_deliveries d
      set batch_key = gen_random_uuid(), claimed_at = 'epoch'
      where d.campaign_id = p_campaign and d.batch_key = p_batch and d.status = 'sending';
  else
    raise exception 'Unknown outcome.' using errcode = '22023';
  end if;

  return public.newsletter_progress(p_campaign);
end;
$fn$;

-- Puts the addresses the provider turned down back in the queue (with new keys: they were never sent).
create or replace function public.newsletter_retry_failed(p_campaign uuid)
returns integer
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_count int;
begin
  if not coalesce((select private.is_admin()), false) then
    raise exception 'Only the site admin can send newsletters.' using errcode = '42501';
  end if;
  update public.newsletter_deliveries d
    set status = 'pending', batch_key = null, claimed_at = null, error = null
    where d.campaign_id = p_campaign and d.status = 'failed';
  get diagnostics v_count = row_count;
  if v_count > 0 then
    update public.newsletter_campaigns c set status = 'sending', finished_at = null where c.id = p_campaign and c.status = 'sent';
  end if;
  return v_count;
end;
$fn$;

grant execute on function public.newsletter_subscribe(text, text) to anon, authenticated;
grant execute on function public.newsletter_lookup(uuid) to anon, authenticated;
grant execute on function public.newsletter_unsubscribe(uuid) to anon, authenticated;
revoke execute on function public.newsletter_progress(uuid) from public, anon;
revoke execute on function public.newsletter_start(uuid) from public, anon;
revoke execute on function public.newsletter_claim(uuid, integer) from public, anon;
revoke execute on function public.newsletter_settle(uuid, uuid, text, text[], text) from public, anon;
revoke execute on function public.newsletter_retry_failed(uuid) from public, anon;
grant execute on function public.newsletter_progress(uuid) to authenticated;
grant execute on function public.newsletter_start(uuid) to authenticated;
grant execute on function public.newsletter_claim(uuid, integer) to authenticated;
grant execute on function public.newsletter_settle(uuid, uuid, text, text[], text) to authenticated;
grant execute on function public.newsletter_retry_failed(uuid) to authenticated;
