-- About page, part two.
-- Personal life (life outside work and hobbies) moves into a table only admins can read.
-- Visitors see it after entering a five-letter access code issued from admin. One function checks
-- the code and returns the content; it counts wrong tries per visitor and across the whole site,
-- and pauses when there are too many, so codes can't be guessed through the public API either.

-- Private content --------------------------------------------------------------
create table if not exists public.about_private (
  id boolean primary key default true check (id),
  personal text check (personal is null or char_length(personal) <= 12000),
  hobbies jsonb not null default '[]'::jsonb
    check (jsonb_typeof(hobbies) = 'array' and pg_column_size(hobbies) < 100000),
  updated_at timestamptz not null default now()
);

insert into public.about_private (id, personal, hobbies)
select true, s.about_personal, coalesce(s.about_hobbies, '[]'::jsonb)
from public.site_settings s
where s.id
on conflict (id) do nothing;

alter table public.about_private enable row level security;
create policy "Admins read private about" on public.about_private
  for select to authenticated using ((select private.is_admin()));
create policy "Admins update private about" on public.about_private
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create trigger about_private_touch before update on public.about_private
  for each row execute function private.touch_updated_at();

-- Access codes -----------------------------------------------------------------
create table if not exists public.about_access_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z]{5}$'),
  label text not null default '' check (char_length(label) <= 80),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  use_count integer not null default 0,
  last_used_at timestamptz
);

alter table public.about_access_codes enable row level security;
create policy "Admins manage access codes" on public.about_access_codes
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- Wrong tries (private schema: not reachable through the API).
create table if not exists private.about_access_failures (
  client text not null,
  at timestamptz not null default now()
);
create index if not exists about_access_failures_at_idx on private.about_access_failures (at);
create index if not exists about_access_failures_client_idx on private.about_access_failures (client, at);

-- Checks a code and returns {status}: 'ok' (with personal and hobbies), 'invalid' or 'locked'.
-- p_unlock is true when a visitor types the code (counted as a use), false on later visits.
create or replace function public.about_personal(p_code text, p_client text, p_unlock boolean default false)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_client text := left(coalesce(p_client, ''), 64);
  v_personal text;
  v_hobbies jsonb;
begin
  delete from private.about_access_failures where at < now() - interval '1 day';

  if (select count(*) from private.about_access_failures f where f.client = v_client and f.at > now() - interval '15 minutes') >= 8
     or (select count(*) from private.about_access_failures f where f.at > now() - interval '10 minutes') >= 40 then
    return jsonb_build_object('status', 'locked');
  end if;

  select c.id into v_id
  from public.about_access_codes c
  where c.code = upper(btrim(coalesce(p_code, '')))
    and c.revoked_at is null
    and (c.expires_at is null or c.expires_at > now());

  if v_id is null then
    insert into private.about_access_failures (client) values (v_client);
    return jsonb_build_object('status', 'invalid');
  end if;

  update public.about_access_codes
  set use_count = use_count + case when p_unlock then 1 else 0 end, last_used_at = now()
  where id = v_id;

  select p.personal, p.hobbies into v_personal, v_hobbies from public.about_private p where p.id;
  return jsonb_build_object('status', 'ok', 'personal', v_personal, 'hobbies', coalesce(v_hobbies, '[]'::jsonb));
end;
$$;

revoke all on function public.about_personal(text, text, boolean) from public;
grant execute on function public.about_personal(text, text, boolean) to anon, authenticated;

-- Company logos are often SVG.
update storage.buckets
set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']
where id = 'article-images';

-- Later, once nothing reads them (run separately; needs confirmation):
-- alter table public.site_settings drop column about_personal, drop column about_hobbies;
