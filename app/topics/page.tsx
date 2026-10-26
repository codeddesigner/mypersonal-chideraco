import Link from 'next/link'
import type { Metadata } from 'next'
import { accentFor } from '@/lib/accent'
import { getTopics } from '@/lib/queries'
import { pageMetadata } from '@/lib/seo'
import { site } from '@/lib/site'
import { plural } from '@/lib/utils'

export async function generateMetadata(): Promise<Metadata> {
  const names = (await getTopics()).filter((t) => t.article_count > 0).map((t) => t.name.toLowerCase())
  return pageMetadata({
    title: 'Topics',
    description: names.length ? `Browse ${site.author}’s articles by topic: ${names.join(', ')}.` : `Browse ${site.author}’s articles by topic.`,
    path: '/topics',
  })
}

export default async function TopicsPage() {
  const topics = await getTopics()
  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">Topics</h1>
        <p className="page-sub">The writing, sorted by what it’s about.</p>
      </header>
      {topics.length > 0 ? (
        <ul className="topic-index">
          {topics.map((topic) => (
            <li key={topic.slug} data-accent={accentFor(null, topic.slug)}>
              <Link href={`/topics/${topic.slug}`} data-event="topic_selected" data-topic={topic.slug}>
                <span className="topic-index-name">{topic.name}</span>
                <span className="count-badge" aria-label={plural(topic.article_count, 'article')}>
                  {topic.article_count}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty">
          <p>No topics yet.</p>
        </div>
      )}
    </div>
  )
}
