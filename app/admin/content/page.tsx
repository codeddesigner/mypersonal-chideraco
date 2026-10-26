import type { Metadata } from 'next'
import PortraitField from '@/components/PortraitField'
import { requireAdmin } from '@/lib/auth'
import Link from 'next/link'
import { DEFAULT_CONTENT, PRICE_TOKEN, footerAbout, heroLines, heroPhoto, joinLines, newsletterTemplate, portrait, priceLabel, subscribeContent } from '@/lib/content'
import { getSettings } from '@/lib/queries'
import { one } from '@/lib/utils'
import { updateContent } from '../content-actions'

export const metadata: Metadata = { title: 'Site content' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function AdminContent({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin()
  const sp = await searchParams
  const message = one(sp.message)
  const error = one(sp.error)
  const settings = await getSettings()
  const subscribe = subscribeContent(settings)

  return (
    <div className="settings">
      <div className="admin-head">
        <h1>Site content</h1>
        <a href="/" className="btn btn-secondary" target="_blank" rel="noopener noreferrer">
          View home page
        </a>
      </div>
      <p className="muted" style={{ margin: '0 0 14px' }}>
        The words and pictures around your writing. Articles, the About page and links (under Settings) each have their own section.
        In every box, press Enter where you want a new line; the site breaks the line in the same place.
      </p>
      <nav className="tabs" aria-label="Sections on this page" style={{ marginBottom: 24 }}>
        <a href="#home-page">Home page</a>
        <a href="#subscribe-page">Subscribe page</a>
        <a href="#footer">Footer</a>
      </nav>
      {message && (
        <p className="notice success" role="status" style={{ marginBottom: 16 }}>
          {message}
        </p>
      )}
      {error && (
        <p className="notice error" role="alert" style={{ marginBottom: 16 }}>
          {error}
        </p>
      )}

      <form action={updateContent} className="form" style={{ marginTop: 0 }}>
        <fieldset id="home-page">
          <legend>Home page heading</legend>
          <div className="field">
            <label htmlFor="hero_lines">Heading</label>
            <textarea id="hero_lines" name="hero_lines" className="input content-lines" rows={4} defaultValue={joinLines(heroLines(settings))} />
            <p className="hint">
              One line per row, exactly as it should appear on the page. Each gets the yellow highlight and the arrow follows the
              last one. Up to four.
            </p>
          </div>
        </fieldset>

        <fieldset>
          <legend>Photo, large on the right</legend>
          <PortraitField
            defaultUrl={settings.hero_photo_url ?? ''}
            fallbackSrc={DEFAULT_CONTENT.photo.src}
            defaultAlt={heroPhoto(settings).alt}
            urlName="hero_photo_url"
            altName="hero_photo_alt"
            prefix="photo"
            uploadLabel="Upload a new photo"
            resetLabel="Use the original photo"
            hint="Stands beside the heading. A portrait photo works best; it’s trimmed to a 4 by 5 frame, keeping the top and middle. PNG, JPEG or WebP, up to 5 MB."
          />
        </fieldset>

        <fieldset>
          <legend>Portrait, small in the bottom-left corner</legend>
          <PortraitField defaultUrl={settings.portrait_url ?? ''} fallbackSrc={DEFAULT_CONTENT.portrait.src} defaultAlt={portrait(settings).alt} />
        </fieldset>

        <fieldset id="subscribe-page">
          <legend>Subscribe page</legend>
          <p className="hint" style={{ margin: '0 0 14px' }}>
            Edit the wording in any box; empty a box to go back to the original. The price, plan name and payment link are under{' '}
            <Link href="/admin/settings" className="text-link">
              Settings → Subscriptions
            </Link>
            .{' '}
            <a href="/subscribe" target="_blank" rel="noopener noreferrer" className="text-link">
              View the Subscribe page
            </a>
          </p>
          <div className="field">
            <label htmlFor="subscribe_heading">Heading</label>
            <textarea
              id="subscribe_heading"
              name="subscribe_heading"
              className="input content-lines"
              rows={2}
              maxLength={80}
              defaultValue={subscribe.heading}
            />
          </div>
          <div className="field" style={{ marginTop: 16 }}>
            <label htmlFor="subscribe_intro">Line under the heading</label>
            <textarea
              id="subscribe_intro"
              name="subscribe_intro"
              className="input"
              rows={2}
              maxLength={300}
              defaultValue={subscribe.intro}
            />
            <p className="hint">
              Press Enter for a new line.{' '}
              {settings.checkout_url
                ? 'The page adds “Leave your email, then pay on the next page.” after it.'
                : 'Until there’s a payment link, the page adds “Leave your email and you’ll get the payment link as soon as it opens.” after it.'}
            </p>
          </div>
          <div className="field" style={{ marginTop: 16 }}>
            <label htmlFor="subscribe_note">Note under the price</label>
            <textarea id="subscribe_note" name="subscribe_note" className="input" rows={5} maxLength={4000} defaultValue={settings.subscribe_note ?? ''} />
            <p className="hint">
              What subscribers get, how billing works, how to cancel. Each line is a paragraph; **bold**, *italic* and - lists work.
              Leave it empty to show nothing.
            </p>
          </div>
          <div className="field" style={{ marginTop: 16 }}>
            <label htmlFor="subscribe_art_line">Line beside the drawing</label>
            <textarea
              id="subscribe_art_line"
              name="subscribe_art_line"
              className="input content-lines"
              rows={2}
              maxLength={140}
              defaultValue={subscribe.artLine}
            />
            <p className="hint">
              The large sentence under the yellow drawing. Press Enter where you want a new line; otherwise it wraps to fit the
              screen. It shows on laptops and wider screens; phones leave the drawing out.
            </p>
          </div>
        </fieldset>

        <fieldset id="footer">
          <legend>Footer</legend>
          <div className="field">
            <label htmlFor="newsletter_heading">Sign-up heading</label>
            <textarea
              id="newsletter_heading"
              name="newsletter_heading"
              className="input content-lines"
              rows={3}
              defaultValue={joinLines(newsletterTemplate(settings))}
            />
            <p className="hint">
              One line per row, above the sign-up box at the foot of every page except Subscribe. Write {PRICE_TOKEN} where the price
              goes; it shows as {priceLabel(settings)}, set under Settings → Subscriptions.
            </p>
          </div>
          <div className="field" style={{ marginTop: 16 }}>
            <label htmlFor="footer_about">Footer description</label>
            <textarea id="footer_about" name="footer_about" className="input" rows={4} defaultValue={footerAbout(settings)} />
            <p className="hint">The short paragraph under the name at the bottom of every page. Press Enter for a new line.</p>
          </div>
        </fieldset>

        <div>
          <button type="submit" className="btn">
            Save site content
          </button>
        </div>
      </form>
    </div>
  )
}
