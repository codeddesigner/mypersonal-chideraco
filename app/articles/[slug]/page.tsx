import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ArticleGrid from '@/components/ArticleGrid'
import ArticleView from '@/components/ArticleView'
import type { GateReason } from '@/components/AuthPrompt'
import { TrackEvent } from '@/components/Analytics'
import Comments from '@/components/Comments'
import { panelAttrs } from '@/lib/accent'
import { getProfile, getUser } from '@/lib/auth'
import { getAdjacent, getArticleBody, getArticleBySlug, getComments, getRelated, getSettings } from '@/lib/queries'
import { absoluteUrl, breadcrumbLd, FEED, graph, jsonLd, PERSON_ID, personLd, websiteLd, WEBSITE_ID } from '@/lib/seo'
import { site } from '@/lib/site'
import { oneLine } from '@/lib/utils'

type Params = Promise<{ slug: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params
  const article = await getArticleBySlug(slug)
  if (!article) return { title: 'Article not found', robots: { index: false } }
  const url = `/articles/${article.slug}`
  const title = oneLine(article.title)
  return {
    title,
    description: article.description || undefined,
    alternates: { canonical: url, types: FEED },
    authors: [{ name: article.author }],
    openGraph: {
      type: 'article',
      url,
      siteName: site.brand,
      title,
      description: article.description || undefined,
      publishedTime: article.published_at,
      modifiedTime: article.updated_at ?? undefined,
      section: article.topics[0]?.name,
      authors: [article.author],
      tags: article.topics.map((t) => t.name),
    },
    twitter: { card: 'summary_large_image', title, description: article.description || undefined },
  }
}

export default async function ArticlePage({ params }: { params: Params }) {
  const { slug } = await params
  const article = await getArticleBySlug(slug)
  if (!article) notFound()

  // The body query runs as the current reader; the database returns nothing without access.
  const [user, body, adjacent, related, settings] = await Promise.all([
    getUser(),
    getArticleBody(article.id),
    getAdjacent(article.id),
    getRelated(article.id, 4),
    getSettings(),
  ])

  const profile = user ? await getProfile() : null
  let gate: GateReason = 'signin'
  if (user) {
    gate = profile?.status === 'suspended' ? 'inactive' : article.access === 'subscribers' && settings.subscriptions_enabled ? 'subscribe' : 'inactive'
  }
  // Comments sit under the full article, for readers who can read it.
  const comments = body !== null ? await getComments(article.id) : []

  // For search engines: what the article is, who wrote it, when, and where it sits on the site.
  const url = absoluteUrl(`/articles/${article.slug}`)
  const byChidera = article.author === site.author
  const structured = graph(
    {
      '@type': 'BlogPosting',
      '@id': `${url}#article`,
      headline: oneLine(article.title),
      ...(article.description ? { description: article.description } : {}),
      image: absoluteUrl(`/articles/${article.slug}/opengraph-image`),
      datePublished: article.published_at,
      dateModified: article.updated_at ?? article.published_at,
      author: byChidera ? { '@id': PERSON_ID } : { '@type': 'Person', name: article.author },
      publisher: { '@id': PERSON_ID },
      isPartOf: { '@id': WEBSITE_ID },
      mainEntityOfPage: url,
      inLanguage: 'en',
      isAccessibleForFree: article.access === 'public',
      timeRequired: `PT${article.reading_minutes}M`,
      ...(article.topics.length ? { articleSection: article.topics[0].name, keywords: article.topics.map((t) => t.name).join(', ') } : {}),
    },
    breadcrumbLd([
      { name: 'Home', path: '/' },
      { name: 'Articles', path: '/articles' },
      { name: oneLine(article.title), path: `/articles/${article.slug}` },
    ]),
    personLd(settings.social_links),
    websiteLd(),
  )

  return (
    <div className="page page-article">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structured) }} />
      <ArticleView article={article} body={body} gate={gate} />
      {body !== null && <Comments articleId={article.id} slug={article.slug} comments={comments} profile={profile} />}

      {(adjacent.previous || adjacent.next) && (
        <nav className="adjacent" aria-label="Previous and next articles">
          {adjacent.previous ? (
            <Link href={`/articles/${adjacent.previous.slug}`} className="adjacent-link" {...panelAttrs(adjacent.previous.accent, adjacent.previous.slug, adjacent.previous.text_colour)}>
              <span className="note">Previous</span>
              <span className="adjacent-title">{adjacent.previous.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {adjacent.next ? (
            <Link href={`/articles/${adjacent.next.slug}`} className="adjacent-link next" {...panelAttrs(adjacent.next.accent, adjacent.next.slug, adjacent.next.text_colour)}>
              <span className="note">Next</span>
              <span className="adjacent-title">{adjacent.next.title}</span>
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}

      {related.length > 0 && (
        <section className="section" aria-labelledby="related-heading">
          <div className="section-head">
            <h2 id="related-heading" className="section-title">
              Related writing
            </h2>
            <Link href="/articles" className="text-link">
              All articles
            </Link>
          </div>
          <ArticleGrid articles={related} />
        </section>
      )}

      <TrackEvent name="article_viewed" articleId={article.id} />
    </div>
  )
}
