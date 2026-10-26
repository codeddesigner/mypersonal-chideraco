import Link from 'next/link'
import type { Metadata } from 'next'
import { Fragment, type CSSProperties } from 'react'
import ArticleGrid from '@/components/ArticleGrid'
import FeaturedArticle from '@/components/FeaturedArticle'
import TopicStatement from '@/components/TopicStatement'
import { heroLayout, heroLines, heroPhoto, portrait, type HeroLayout } from '@/lib/content'
import { getFeatured, getSettings, getTopics, listArticles } from '@/lib/queries'
import { graph, jsonLd, pageMetadata, personLd, websiteLd } from '@/lib/seo'
import { site } from '@/lib/site'
import './home.css'

export const metadata: Metadata = pageMetadata({ path: '/', description: site.description })

// --l staggers the highlighter line by line; --lines times the arrow after the last one;
// --fit and --fit-sm size the heading so each line stays whole (see heroLayout).
const lineStyle = (i: number) => ({ '--l': i }) as CSSProperties
const titleStyle = (layout: HeroLayout) =>
  ({ '--lines': layout.lines.length, '--fit': layout.fit, '--fit-sm': layout.fitSmall }) as CSSProperties

// A line in one or two parts; the break between parts only shows on phones.
function LineText({ parts }: { parts: string[] }) {
  return parts.map((part, j) => (
    <Fragment key={j}>
      {j > 0 && ' '}
      {j > 0 && <br className="hero-br" />}
      {part}
    </Fragment>
  ))
}

export default async function HomePage() {
  const [featuredPick, latest, topics, settings] = await Promise.all([
    getFeatured(),
    listArticles({ limit: 13 }),
    getTopics(),
    getSettings(),
  ])

  const featured = featuredPick ?? latest.articles[0] ?? null
  const grid = latest.articles.filter((a) => a.id !== featured?.id).slice(0, 12)
  const layout = heroLayout(heroLines(settings))
  const last = layout.lines.length - 1
  const picture = portrait(settings)
  const photo = heroPhoto(settings)

  return (
    <div className="home">
      {/* For search engines: the site's name (Chidera’s Note) and who writes it. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(graph(websiteLd(), personLd(settings.social_links))) }} />
      {/* The heading and buttons sit centred between two pictures: the photo on the right,
          and the drawing on a small card in the bottom-left corner. */}
      <section className="hero panel-accent" data-accent="ash" aria-labelledby="hero-title">
        <div className="hero-copy">
          <h1 id="hero-title" className="hero-title" style={titleStyle(layout)}>
            {layout.lines.map((parts, i) => (
              <Fragment key={i}>
                {i > 0 && <br />}
                {i < last ? (
                  <span className="hl" style={lineStyle(i)}>
                    <LineText parts={parts} />
                  </span>
                ) : (
                  <span className="hero-last">
                    <span className="hl" style={lineStyle(i)}>
                      <LineText parts={parts} />
                    </span>
                    <svg className="hero-arrow" viewBox="0 0 140 64" aria-hidden="true" focusable="false">
                      <path pathLength={1} d="M6 22C34 6 66 4 74 22c7 16-14 26-20 14-7-14 28-16 50-2 10 7 18 14 24 22" />
                      <path pathLength={1} d="M113 51l15 5.5-1-15.5" />
                    </svg>
                  </span>
                )}
              </Fragment>
            ))}
          </h1>
          <div className="hero-actions">
            <a href="/book" className="btn">
              Book a meeting
            </a>
            <Link href="/subscribe" className="btn btn-secondary" data-event="subscription_initiated">
              Subscribe
            </Link>
          </div>
        </div>
        <div className="hero-photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} fetchPriority="high" />
        </div>
        <div className="hero-portrait">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={picture.src} alt={picture.alt} width={picture.width} height={picture.height} />
        </div>
      </section>

      {/* Every topic, in the order set in Admin → Topics, including ones with nothing published yet. */}
      <TopicStatement topics={topics} />

      {featured ? (
        <FeaturedArticle article={featured} />
      ) : (
        <div className="empty">
          <p>Nothing has been published yet.</p>
        </div>
      )}

      {grid.length > 0 && (
        <section className="section" aria-labelledby="latest-heading">
          <div className="section-head">
            <h2 id="latest-heading" className="section-title">
              Latest writing
            </h2>
            <Link href="/articles" className="text-link">
              All {latest.total} articles
            </Link>
          </div>
          <ArticleGrid articles={grid} />
        </section>
      )}
    </div>
  )
}
