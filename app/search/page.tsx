import Link from 'next/link'
import type { Metadata } from 'next'
import ArticleGrid from '@/components/ArticleGrid'
import Pagination from '@/components/Pagination'
import SearchForm from '@/components/SearchForm'
import TopicList from '@/components/TopicList'
import { TrackEvent } from '@/components/Analytics'
import { getTopics, listArticles } from '@/lib/queries'
import { buildHref, one, plural } from '@/lib/utils'

export const metadata: Metadata = { title: 'Search', robots: { index: false, follow: true } }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const q = (one(sp.q) ?? '').trim().slice(0, 100)
  const page = Math.max(1, Number.parseInt(one(sp.page) ?? '1', 10) || 1)

  const [result, topics] = await Promise.all([q ? listArticles({ q, page }) : Promise.resolve(null), getTopics()])
  const activeTopics = topics.filter((t) => t.article_count > 0)

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">Search</h1>
        <p className="page-sub">Titles, descriptions and the full text of every article.</p>
      </header>
      <div className="toolbar">
        <SearchForm action="/search" q={q} autoFocus={!q} />
      </div>

      {result ? (
        <>
          <p className="filters-note" aria-live="polite">
            {plural(result.total, 'result')} for “{q}”
          </p>
          {result.articles.length > 0 ? (
            <ArticleGrid articles={result.articles} headingLevel={2} />
          ) : (
            <div className="empty">
              <p>Try a different word, or browse by topic.</p>
              <TopicList topics={activeTopics} hrefFor={(slug) => `/topics/${slug}`} />
            </div>
          )}
          <Pagination page={result.page} pageCount={result.pageCount} hrefFor={(n) => buildHref('/search', { q, page: n })} />
          <TrackEvent name="search_performed" query={q} />
        </>
      ) : (
        <div className="section">
          <p className="filters-note">Or browse by topic:</p>
          <TopicList topics={activeTopics} hrefFor={(slug) => `/topics/${slug}`} />
          <p className="more">
            <Link href="/articles" className="text-link">
              All articles
            </Link>
          </p>
        </div>
      )}
    </div>
  )
}
