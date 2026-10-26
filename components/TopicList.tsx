import Link from 'next/link'

type TopicLike = { name: string; slug: string; article_count?: number }

export default function TopicList({
  topics,
  hrefFor,
  active,
  allHref,
  label = 'Topics',
}: {
  topics: TopicLike[]
  hrefFor: (slug: string) => string
  active?: string
  allHref?: string
  label?: string
}) {
  return (
    <ul className="topics" aria-label={label}>
      {allHref && (
        <li>
          <Link href={allHref} className={`topic-pill${!active ? ' active' : ''}`} aria-current={!active ? 'true' : undefined}>
            All
          </Link>
        </li>
      )}
      {topics.map((topic) => {
        const isActive = active === topic.slug
        return (
          <li key={topic.slug}>
            <Link
              href={hrefFor(topic.slug)}
              className={`topic-pill${isActive ? ' active' : ''}`}
              aria-current={isActive ? 'true' : undefined}
              data-event="topic_selected"
              data-topic={topic.slug}
            >
              {topic.name}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
