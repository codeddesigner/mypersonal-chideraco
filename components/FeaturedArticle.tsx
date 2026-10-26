import Link from 'next/link'
import { panelAttrs } from '@/lib/accent'
import { formatDate, readingTime } from '@/lib/format'
import type { ArticleSummary } from '@/lib/types'
import Cover from './Cover'
import { Circled, Squiggle } from './Doodles'

export default function FeaturedArticle({ article }: { article: ArticleSummary }) {
  const href = `/articles/${article.slug}`
  const topics = article.topics.slice(0, 2)
  return (
    <section className="feature panel-accent" {...panelAttrs(article.accent, article.slug, article.text_colour)} aria-labelledby="featured-title">
      <div className="strip">
        <span>Featured</span>
        <time dateTime={article.published_at}>{formatDate(article.published_at, 'long')}</time>
        <span className="strip-end">
          {topics.map((topic, i) => (
            <span key={topic.slug}>
              {i > 0 && ', '}
              <Link href={`/topics/${topic.slug}`} data-event="topic_selected" data-topic={topic.slug}>
                {topic.name}
              </Link>
            </span>
          ))}
        </span>
      </div>

      <div className="feature-body">
        <Link href={href} className="feature-cover" tabIndex={-1} aria-hidden="true" data-event="read_more_clicked" data-article={article.id}>
          <Cover article={article} sizes="(max-width: 900px) 100vw, 46vw" priority />
        </Link>

        <div className="feature-text">
          <p className="byline">
            <Circled>{readingTime(article.reading_minutes)}</Circled>
          </p>
          <h2 id="featured-title" className="feature-title">
            <Link href={href} data-event="read_more_clicked" data-article={article.id}>
              {article.title}
            </Link>
          </h2>
          {article.description && <p className="feature-excerpt">{article.description}</p>}
          <Link href={href} className="cta-link" data-event="read_more_clicked" data-article={article.id}>
            <Squiggle>Read the article</Squiggle>
          </Link>
        </div>
      </div>
    </section>
  )
}
