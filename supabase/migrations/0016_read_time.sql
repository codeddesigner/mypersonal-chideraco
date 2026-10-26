-- A read time set by hand in the article editor. Empty means it's worked out from the length
-- (230 words a minute), as before. reading_minutes stays the figure the site shows either way.

alter table public.articles add column if not exists reading_minutes_set integer
  check (reading_minutes_set is null or reading_minutes_set between 1 and 600);

-- Saving the text recalculates the read time, unless one has been set by hand.
create or replace function private.article_bodies_reading_time()
returns trigger language plpgsql security definer set search_path = ''
as $fn$
declare
  words int;
begin
  words := coalesce(array_length(regexp_split_to_array(btrim(new.body), '\s+'), 1), 0);
  update public.articles
    set reading_minutes = coalesce(reading_minutes_set, greatest(1, ceil(words / 230.0)::int))
    where id = new.article_id;
  return new;
end;
$fn$;

-- Setting a read time shows it straight away; clearing it goes back to the worked-out figure.
create or replace function private.articles_reading_time()
returns trigger language plpgsql security definer set search_path = ''
as $fn$
begin
  if new.reading_minutes_set is not null then
    new.reading_minutes := new.reading_minutes_set;
  elsif tg_op = 'UPDATE' and old.reading_minutes_set is not null then
    select greatest(1, ceil(coalesce(array_length(regexp_split_to_array(btrim(b.body), '\s+'), 1), 0) / 230.0)::int)
      into new.reading_minutes
      from public.article_bodies b where b.article_id = new.id;
    new.reading_minutes := coalesce(new.reading_minutes, 1);
  end if;
  return new;
end;
$fn$;

create or replace trigger articles_reading_time before insert or update of reading_minutes_set on public.articles
  for each row execute function private.articles_reading_time();
