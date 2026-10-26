import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ArticleGrid from '@/components/ArticleGrid'
import Pagination from '@/components/Pagination'
import TopicList from '@/components/TopicList'
import { accentFor } from '@/lib/accent'
import { getTopics, listArticles } from '@/lib/queries'
import { breadcrumbLd, graph, jsonLd, pagedPath, pageMetadata } from '@/lib/seo'
import { site } from '@/lib/site'
import { buildHref, one, plural } from '@/lib/utils'

type Params = Promise<{ slug: string }>
type SearchParams = Promise<Record<string, string | string[] | undefined>>

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: SearchParams }): Promise<Metadata> {
  const { slug } = await params
  const page = Math.max(1, Number.parseInt(one((await searchParams).page) ?? '1', 10) || 1)
  const topic = (await getTopics()).find((t) => t.slug === slug)
  if (!topic) return { title: 'Topic not found' }
  return pageMetadata({
    title: page > 1 ? `${topic.name} articles, page ${page}` : `${topic.name} articles`,
    description: `Articles by ${site.author}, ${site.role.toLowerCase()}, on ${topic.name.toLowerCase()}. ${plural(topic.article_count, 'article')} so far.`,
    path: pagedPath(`/topics/${topic.slug}`, page),
    // A topic with nothing published yet is an empty page; it's listed once there's something in it.
    noindex: topic.article_count === 0,
  })
}

export default async function TopicPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { slug } = await params
  const sp = await searchParams
  const page = Math.max(1, Number.parseInt(one(sp.page) ?? '1', 10) || 1)

  const topics = await getTopics()
  const topic = topics.find((t) => t.slug === slug)
  if (!topic) notFound()

  const result = await listArticles({ topic: topic.slug, page })

  return (
    <div className="page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(graph(breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Topics', path: '/topics' }, { name: topic.name, path: `/topics/${topic.slug}` }]))),
        }}
      />
      <header className="topic-hero panel-accent" data-accent={accentFor(null, topic.slug)}>
        <div className="strip">
          <Link href="/topics">All topics</Link>
          <span className="strip-end">{plural(result.total, 'article')}</span>
        </div>
        <h1 className="topic-hero-title">{topic.name}</h1>
      </header>

      <div className="filters">
        <TopicList topics={topics.filter((t) => t.article_count > 0 || t.slug === slug)} active={topic.slug} hrefFor={(s) => `/topics/${s}`} label="Other topics" />
      </div>

      {result.articles.length > 0 ? (
        <ArticleGrid articles={result.articles} headingLevel={2} />
      ) : (
        <div className="empty">
          <p>Nothing has been published in {topic.name} yet.</p>
          <Link href="/articles" className="btn btn-secondary">
            See all articles
          </Link>
        </div>
      )}

      <Pagination page={result.page} pageCount={result.pageCount} hrefFor={(n) => buildHref(`/topics/${topic.slug}`, { page: n })} />
    </div>
  )
}
