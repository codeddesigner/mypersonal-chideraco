import Link from 'next/link'
import { Fragment } from 'react'
import { getUser } from '@/lib/auth'
import { footerAbout, newsletterLines } from '@/lib/content'
import { getSettings } from '@/lib/queries'
import { site } from '@/lib/site'
import BackToTop from './BackToTop'
import NewsletterForm from './NewsletterForm'

export default async function Footer() {
  const [user, settings] = await Promise.all([getUser(), getSettings()])
  const year = new Date().getFullYear()
  const { booking_url: booking, contact_email: email, press_kit_url: pressKit, social_links: elsewhere } = settings
  const hasPress = Boolean(booking || email || pressKit)
  // The sign-up is paid: the email is saved, then the reader continues to the payment link from Admin → Settings.
  const heading = newsletterLines(settings)

  return (
    <footer className="footer">
      <section id="newsletter" className="newsletter panel-accent" data-accent="lemon" aria-labelledby="newsletter-title">
        <h2 id="newsletter-title" className="newsletter-line">
          {heading.map((line, i) => (
            <Fragment key={i}>
              {i > 0 && <br />}
              {line}
            </Fragment>
          ))}
        </h2>
        <NewsletterForm source="footer" note={settings.checkout_url ? 'You’ll pay on the next page.' : undefined} />
      </section>

      <div className="footer-main">
        <div className="footer-brand">
          <Link href="/" className="footer-mark">
            {site.brand}
          </Link>
          <p className="footer-about">{footerAbout(settings)}</p>
        </div>

        <nav className="footer-col" aria-labelledby="footer-read">
          <h2 id="footer-read" className="footer-head">
            Read
          </h2>
          <ul className="footer-list">
            <li>
              <Link href="/articles">All articles</Link>
            </li>
            <li>
              <Link href="/topics">Topics</Link>
            </li>
            <li>
              <Link href="/search">Search</Link>
            </li>
          </ul>
        </nav>

        <nav className="footer-col" aria-labelledby="footer-site">
          <h2 id="footer-site" className="footer-head">
            Chidera
          </h2>
          <ul className="footer-list">
            <li>
              <Link href="/about">About me</Link>
            </li>
            <li>
              <a href="/book">Book a meeting</a>
            </li>
            <li>
              <Link href="/subscribe" data-event="subscription_initiated">
                Subscribe
              </Link>
            </li>
            <li>{user ? <Link href="/account">Your account</Link> : <Link href="/login">Sign in</Link>}</li>
          </ul>
        </nav>

        {hasPress && (
          <div className="footer-col">
            <h2 className="footer-head">For press</h2>
            <p className="footer-note">Interviews, features and speaking requests.</p>
            <ul className="footer-list">
              {pressKit && (
                <li>
                  <a href={pressKit} target="_blank" rel="noopener noreferrer">
                    Press kit
                  </a>
                </li>
              )}
              {email && (
                <li>
                  <a href={`mailto:${email}`}>{email}</a>
                </li>
              )}
            </ul>
          </div>
        )}

        {elsewhere.length > 0 && (
          <div className="footer-col">
            <h2 className="footer-head">Elsewhere</h2>
            <ul className="footer-list">
              {elsewhere.map((link) => (
                <li key={link.url}>
                  <a href={link.url} target={link.url.startsWith('mailto:') ? undefined : '_blank'} rel="noopener noreferrer">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="footer-bottom">
        <span className="footer-copy">
          © {year} {site.author}
        </span>
        <span className="footer-copy">Built and managed by South Circle Inc</span>
        <BackToTop className="footer-copy" />
      </div>
    </footer>
  )
}
