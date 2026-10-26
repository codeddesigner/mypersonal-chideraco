import Link from 'next/link'
import { Fragment } from 'react'
import { plural } from '@/lib/utils'

type TopicCount = { name: string; slug: string; article_count: number }

// Lowercase ordinary words so the list reads as a sentence; leave acronyms and names like "iOS" alone.
function inSentence(name: string) {
  return name
    .split(' ')
    .map((word) => (/^[A-Z][a-z’'-]*$/.test(word) ? word.toLowerCase() : word))
    .join(' ')
}

export default function TopicStatement({ topics }: { topics: TopicCount[] }) {
  if (topics.length === 0) return null
  return (
    <section className="statement" aria-labelledby="statement-heading">
      <div className="statement-side">
        <h2 id="statement-heading" className="note">
          What I write about
        </h2>
        <Link href="/topics" className="text-link">
          Browse topics
        </Link>
      </div>
      {/* One flowing sentence at every size; on phones it's sized to fill the width (home.css). */}
      <p className="statement-text">
        <span className="st-lead">I write about</span>{' '}
        <span className="st-list">
          {topics.map((topic, i) => (
            <Fragment key={topic.slug}>
              {i > 0 && ' '}
              <span className="st-item">
                <Link
                  href={`/topics/${topic.slug}`}
                  className={i % 2 === 0 ? 'st st-sans' : 'st st-serif'}
                  data-event="topic_selected"
                  data-topic={topic.slug}
                >
                  {inSentence(topic.name)}
                  <span className="sr-only"> ({plural(topic.article_count, 'article')})</span>
                  <sup className="count" aria-hidden="true">
                    {topic.article_count}
                  </sup>
                </Link>
                <span className="st-comma">,</span>
              </span>
            </Fragment>
          ))}
        </span>{' '}
        <span className="st-tail">and the things that shape how we think and live.</span>
      </p>
    </section>
  )
}
