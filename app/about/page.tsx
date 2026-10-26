import Link from 'next/link'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import AboutTabs from '@/components/AboutTabs'
import AccessGate from '@/components/AccessGate'
import { Circled } from '@/components/Doodles'
import Journey from '@/components/Journey'
import Prose from '@/components/Prose'
import { ABOUT_VIEWS, aboutContent, aboutView } from '@/lib/about'
import { loadPersonalLife } from '@/lib/about-private'
import { getSettings } from '@/lib/queries'
import { absoluteUrl, graph, jsonLd, pageMetadata, PERSON_ID, personLd, websiteLd, WEBSITE_ID } from '@/lib/seo'
import { site } from '@/lib/site'
import { one } from '@/lib/utils'
import { lockPersonal } from './actions'
import './about.css'

export const metadata: Metadata = pageMetadata({
  title: `About ${site.author}, ${site.role}`,
  absoluteTitle: true,
  description: `${site.author} is a ${site.role.toLowerCase()}. What I do, the work I’ve done, the brands I’ve worked with, and the writing.`,
  path: '/about',
})

type SearchParams = Promise<Record<string, string | string[] | undefined>>

// Each hobby card takes one of the site's article colours, in turn.
const HOBBY_ACCENTS = ['pool', 'lemon', 'blush', 'iris', 'leaf', 'saffron']

function Section({ id, title, wide, children }: { id: string; title: string; wide?: boolean; children: ReactNode }) {
  return (
    <section className={wide ? 'about-section is-tree' : 'about-section'} aria-labelledby={id}>
      <h2 id={id} className="about-section-title">
        {title}
      </h2>
      <div className="about-section-body">{children}</div>
    </section>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="about-empty">{children}</p>
}

export default async function AboutPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const settings = await getSettings()
  const about = aboutContent(settings)
  const life = await loadPersonalLife()
  const links = settings.social_links.filter((l) => l.label && l.url)

  const hasOpening = Boolean(about.statement || about.credential || about.figures.length > 0)
  const overview = (
    <>
      {hasOpening && (
        <section className="about-opening" aria-label="In short">
          {about.statement && <p className="about-statement">{about.statement}</p>}
          {about.credential && (
            <p className="about-credential">
              <span className="about-credential-mark" aria-hidden="true" />
              {about.credential}
            </p>
          )}
          {about.figures.length > 0 && (
            <ul className="about-figures">
              {about.figures.map((figure, i) => (
                <li key={i}>
                  <span className="about-figure-value">
                    <span className="hl">{figure.value}</span>
                  </span>
                  <span className="about-figure-label">{figure.label}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {about.services.length > 0 && (
        <Section id="about-work" title="How I can help">
          <ul className="services">
            {about.services.map((service, i) => (
              <li key={i}>
                <h3>{service.title}</h3>
                {service.text && <p>{service.text}</p>}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {about.intro.rest && (
        <Section id="about-writing" title="The writing">
          <Prose source={about.intro.rest} className="about-text" />
        </Section>
      )}
      {links.length > 0 && (
        <Section id="elsewhere" title="Elsewhere">
          <ul className="links">
            {links.map((link) => (
              <li key={link.url}>
                <a href={link.url} rel="me noopener" className="text-link">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  )

  const hasWork = about.experience.length > 0 || about.education.length > 0 || about.clients.length > 0
  const work = hasWork ? (
    <>
      {about.experience.length > 0 && (
        <Section id="about-journey" title="The journey" wide>
          <Journey roles={about.experience} />
        </Section>
      )}
      {about.education.length > 0 && (
        <Section id="about-education" title="Education and training">
          <ol className="timeline timeline-compact">
            {about.education.map((item, i) => (
              <li key={i}>
                <p className="timeline-period">{item.period}</p>
                <div>
                  <h3 className="timeline-role">{item.title || item.org}</h3>
                  {item.title && item.org && <p className="timeline-org">{item.org}</p>}
                </div>
              </li>
            ))}
          </ol>
        </Section>
      )}
      {about.clients.length > 0 && (
        <Section id="about-clients" title="Brands I’ve worked with">
          <ul className="clients">
            {about.clients.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </Section>
      )}
    </>
  ) : (
    <Empty>My work history is on its way.</Empty>
  )

  const personal = life.open ? (
    <>
      {life.viaAdmin && <p className="about-note">You’re seeing this because you’re signed in as an admin. Visitors need an access code.</p>}
      {life.personal && (
        <Section id="about-life" title="My personal story">
          <Prose source={life.personal} className="about-text" />
        </Section>
      )}
      {life.hobbies.length > 0 && (
        <Section id="about-hobbies" title="Hobbies">
          <ul className="hobbies">
            {life.hobbies.map((hobby, i) => (
              <li key={i} data-accent={HOBBY_ACCENTS[i % HOBBY_ACCENTS.length]}>
                <h3>{hobby.title}</h3>
                {hobby.text && <p>{hobby.text}</p>}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {!life.personal && life.hobbies.length === 0 && <Empty>Nothing here yet. Check back soon.</Empty>}
      {!life.viaAdmin && (
        <form action={lockPersonal} className="about-lock-again">
          <button type="submit" className="link-btn">
            Lock it again on this device
          </button>
        </form>
      )}
    </>
  ) : (
    <section className="about-gate" data-accent="ash" aria-labelledby="gate-title">
      <h2 id="gate-title" className="about-gate-title">
        For people I know
      </h2>
      <p className="about-gate-text">Enter the five-letter access code I gave you.</p>
      {life.busy && (
        <p className="notice error about-gate-error" role="status" style={{ marginBottom: 20 }}>
          Too many wrong codes have been tried, so the box is paused for a few minutes. Please try again shortly.
        </p>
      )}
      <AccessGate />
      <p className="about-gate-foot">Don’t have a code? Ask me for one.</p>
    </section>
  )

  const tabs = ABOUT_VIEWS.map((view) => ({ id: view.id, label: view.label, ...(view.id === 'personal' ? { locked: !life.open } : {}) }))

  return (
    // On wide screens the photo has a column of its own and stays in view while the rest scrolls past.
    <div className="page about about-layout">
      {/* For search engines: this page is about Chidera. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            graph(
              { '@type': 'ProfilePage', '@id': absoluteUrl('/about'), url: absoluteUrl('/about'), mainEntity: { '@id': PERSON_ID }, isPartOf: { '@id': WEBSITE_ID } },
              personLd(settings.social_links),
              websiteLd(),
            ),
          ),
        }}
      />
      <header className="about-hero-text">
        <h1 className="note about-title">
          About <Circled>{site.author}</Circled>
        </h1>
        {about.intro.lede && <Prose source={about.intro.lede} className="about-lede" />}
        <div className="about-actions">
          <a href="/book" className="btn">
            Book a meeting
          </a>
          <Link href="/articles" className="btn btn-secondary">
            Read the articles
          </Link>
        </div>
      </header>
      <figure className={about.photo.drawing ? 'about-photo is-drawing' : 'about-photo'} data-accent="ash">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={about.photo.src} alt={about.photo.alt} fetchPriority="high" />
      </figure>

      <AboutTabs tabs={tabs} panels={[overview, work, personal]} initial={aboutView(one(sp.view))} />
    </div>
  )
}
