import Link from 'next/link'
import type { Metadata } from 'next'
import ArticleGrid from '@/components/ArticleGrid'
import Pagination from '@/components/Pagination'
import SearchForm from '@/components/SearchForm'
import TopicList from '@/components/TopicList'
import { TrackEvent } from '@/components/Analytics'
import { getTopics, listArticles, type ArticleSort } from '@/lib/queries'
import { pagedPath, pageMetadata } from '@/lib/seo'
import { buildHref, one, plural } from '@/lib/utils'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const DESCRIPTION =
  'Every article by Chidera Nwanyemike, brand and storytelling strategist: essays on business, branding, finance, society, faith, relationships and love.'

// Each page of the list is its own page to search engines; a sort order is the same list, so it points to
// the plain one; a topic filter points to that topic's page; search results aren't listed at all.
export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const sp = await searchParams
  const page = Math.max(1, Number.parseInt(one(sp.page) ?? '1', 10) || 1)
  const topic = (one(sp.topic) ?? '').trim()
  const q = (one(sp.q) ?? '').trim()
  if (q) return pageMetadata({ title: 'Search articles', path: '/articles', noindex: true })
  if (topic) return pageMetadata({ title: 'Articles', description: DESCRIPTION, path: `/topics/${encodeURIComponent(topic)}` })
  return pageMetadata({
    title: page > 1 ? `Articles, page ${page}` : 'Articles on business, branding and life',
    description: DESCRIPTION,
    path: pagedPath('/articles', page),
  })
}

export default async function ArticlesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const q = (one(sp.q) ?? '').trim().slice(0, 100)
  const topic = one(sp.topic) ?? ''
  const sortParam = one(sp.sort)
  const sort: ArticleSort = sortParam === 'oldest' || sortParam === 'newest' ? sortParam : 'arranged'
  const page = Math.max(1, Number.parseInt(one(sp.page) ?? '1', 10) || 1)

  const [result, topics] = await Promise.all([listArticles({ q, topic, sort, page }), getTopics()])
  const activeTopic = topics.find((t) => t.slug === topic)
  const href = (changes: { q?: string; topic?: string; sort?: string; page?: number }) =>
    buildHref('/articles', { q, topic, sort, page: 1, ...changes })

  const filtered = Boolean(q || activeTopic)
  // The order set in admin is offered first once any article has been moved; until then the default is newest first.
  const sorts: { value: ArticleSort; label: string }[] = result.arranged
    ? [
        { value: 'arranged', label: 'Suggested' },
        { value: 'newest', label: 'Newest' },
        { value: 'oldest', label: 'Oldest' },
      ]
    : [
        { value: 'arranged', label: 'Newest' },
        { value: 'oldest', label: 'Oldest' },
      ]
  const currentSort = !result.arranged && sort === 'newest' ? 'arranged' : sort

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">Articles</h1>
        <p className="page-sub">Everything I’ve published. Search the full text or narrow it to one topic.</p>
      </header>

      <div className="toolbar">
        <SearchForm action="/articles" q={q} hidden={{ topic: activeTopic?.slug, sort: sort === 'arranged' ? undefined : sort }} />
        <div className="sort" role="group" aria-label="Sort order">
          {sorts.map((option) => (
            <Link key={option.value} href={href({ sort: option.value })} aria-current={currentSort === option.value ? 'true' : undefined}>
              {option.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="filters">
        <TopicList
          topics={topics.filter((t) => t.article_count > 0 || t.slug === topic)}
          active={activeTopic?.slug}
          allHref={href({ topic: '' })}
          hrefFor={(slug) => href({ topic: slug === activeTopic?.slug ? '' : slug })}
          label="Filter by topic"
        />
      </div>

      <p className="filters-note" aria-live="polite">
        {plural(result.total, 'article')}
        {activeTopic && <> in {activeTopic.name}</>}
        {q && <> matching “{q}”</>}
        {filtered && (
          <Link href="/articles" className="text-link">
            Clear filters
          </Link>
        )}
      </p>

      {result.articles.length > 0 ? (
        <ArticleGrid articles={result.articles} headingLevel={2} />
      ) : (
        <div className="empty">
          <p>{q ? 'Try a different word or topic.' : 'No articles here yet.'}</p>
          <Link href="/articles" className="btn btn-secondary">
            See all articles
          </Link>
        </div>
      )}

      <Pagination page={result.page} pageCount={result.pageCount} hrefFor={(n) => href({ page: n })} />
      {q && <TrackEvent name="search_performed" query={q} />}
    </div>
  )
}
