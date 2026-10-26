import Link from 'next/link'
import { panelAttrs } from '@/lib/accent'
import { formatDate, readingTime } from '@/lib/format'
import type { Article } from '@/lib/types'
import AuthPrompt, { type GateReason } from './AuthPrompt'
import Cover from './Cover'
import { Circled } from './Doodles'
import Prose from './Prose'

export default function ArticleView({
  article,
  body,
  gate,
}: {
  article: Article
  body: string | null
  gate?: GateReason
}) {
  return (
    <article className="article">
      <header className="article-head panel-accent" {...panelAttrs(article.accent, article.slug, article.text_colour)}>
        <div className="strip">
          <Link href="/articles">All articles</Link>
          {article.published_at ? <time dateTime={article.published_at}>{formatDate(article.published_at)}</time> : <span>Not yet published</span>}
          <span className="strip-end">
            {article.topics.slice(0, 3).map((topic, i) => (
              <span key={topic.slug}>
                {i > 0 && ', '}
                <Link href={`/topics/${topic.slug}`} data-event="topic_selected" data-topic={topic.slug}>
                  {topic.name}
                </Link>
              </span>
            ))}
          </span>
        </div>

        <div className="article-head-body">
          <div className="article-head-text">
            <p className="byline">
              <Circled>{readingTime(article.reading_minutes)}</Circled>
              {article.access === 'subscribers' && <span className="byline-time">For subscribers</span>}
            </p>
            <h1 className="article-title">{article.title}</h1>
            {article.description && <p className="standfirst">{article.description}</p>}
          </div>
          <Cover article={article} className="article-cover" sizes="(max-width: 900px) 100vw, 40vw" priority />
        </div>
      </header>

      <div className="article-body">
        {body !== null ? (
          <Prose source={body} />
        ) : (
          <>
            {article.preview && <Prose source={article.preview} className="preview" />}
            <AuthPrompt reason={gate ?? 'signin'} next={`/articles/${article.slug}`} />
          </>
        )}
      </div>
    </article>
  )
}
