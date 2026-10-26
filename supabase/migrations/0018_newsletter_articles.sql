-- A newsletter can go out by email, be published on the site as an article, or both.
-- article_id links a newsletter to the article it came from (Admin → Articles → Email to subscribers)
-- or the article it was published as (Admin → Newsletter → Where it goes).

alter table public.newsletter_campaigns
  add column if not exists article_id uuid references public.articles (id) on delete set null;

create index if not exists newsletter_campaigns_article_idx on public.newsletter_campaigns (article_id);

-- Links a newsletter to an article. The words of a sent newsletter stay locked (see 0017), so the link is
-- set here rather than by an ordinary update, which only drafts allow.
create or replace function public.newsletter_link_article(p_campaign uuid, p_article uuid)
returns void
language plpgsql security definer set search_path = ''
as $fn$
begin
  if not coalesce((select private.is_admin()), false) then
    raise exception 'Only the site admin can do that.' using errcode = '42501';
  end if;
  if p_article is not null and not exists (select 1 from public.articles a where a.id = p_article) then
    raise exception 'That article doesn’t exist.' using errcode = 'P0002';
  end if;
  update public.newsletter_campaigns c set article_id = p_article where c.id = p_campaign;
  if not found then
    raise exception 'That newsletter doesn’t exist.' using errcode = 'P0002';
  end if;
end;
$fn$;

revoke all on function public.newsletter_link_article(uuid, uuid) from public, anon;
grant execute on function public.newsletter_link_article(uuid, uuid) to authenticated;
