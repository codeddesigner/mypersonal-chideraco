import Link from 'next/link'
import { accentAttrs } from '@/lib/accent'
import { formatDate } from '@/lib/format'
import type { ArticleSummary } from '@/lib/types'
import Cover from './Cover'

export function ArticleItem({ article, headingLevel = 3 }: { article: ArticleSummary; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  const topic = article.topics[0]
  return (
    <li className="card" {...accentAttrs(article.accent, article.slug)}>
      <Link href={`/articles/${article.slug}`} className="card-link" data-event="read_more_clicked" data-article={article.id}>
        <Cover article={article} sizes="(max-width: 600px) 100vw, (max-width: 1100px) 33vw, 25vw" />
        <span className="card-meta">
          <time dateTime={article.published_at}>{formatDate(article.published_at, 'short')}</time>
          {article.access === 'subscribers' ? <span>Subscribers</span> : topic ? <span>{topic.name}</span> : null}
        </span>
        <Heading className="card-title">{article.title}</Heading>
        {article.description && <p className="card-desc">{article.description}</p>}
      </Link>
    </li>
  )
}

export default function ArticleGrid({ articles, headingLevel = 3 }: { articles: ArticleSummary[]; headingLevel?: 2 | 3 }) {
  return (
    <ul className="grid">
      {articles.map((article) => (
        <ArticleItem key={article.id} article={article} headingLevel={headingLevel} />
      ))}
    </ul>
  )
}
