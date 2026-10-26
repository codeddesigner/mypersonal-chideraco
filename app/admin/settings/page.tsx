import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { formatDateTime } from '@/lib/format'
import { OFFLINE_DEFAULT_TITLE, OFFLINE_PREVIEW_PATH } from '@/lib/offline'
import { getSettings } from '@/lib/queries'
import { one } from '@/lib/utils'
import { updateSettings } from '../actions'
import { updateAvailability } from '../availability-actions'
import { updateContact } from '../contact-actions'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const PROVIDERS = [
  ['manual', 'Manual (grant subscriptions from Readers)'],
  ['paystack', 'Paystack'],
  ['stripe', 'Stripe'],
  ['flutterwave', 'Flutterwave'],
  ['other', 'Other'],
] as const

export default async function AdminSettings({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin()
  const sp = await searchParams
  const message = one(sp.message)
  const error = one(sp.error)
  const settings = await getSettings()
  const links = settings.social_links.map((l) => `${l.label} | ${l.url}`).join(String.fromCharCode(10)) // one per line
  const offline = settings.site_offline === true
  const since = offline ? formatDateTime(settings.offline_since) : ''

  return (
    <div className="settings">
      <div className="admin-head">
        <h1>Settings</h1>
      </div>
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

      <form action={updateAvailability} className="form availability" id="availability" style={{ marginTop: 0, marginBottom: 40 }} data-offline={offline || undefined}>
        <fieldset>
          <legend>Website availability</legend>
          <p className="availability-state" role="status">
            <span className="availability-dot" aria-hidden="true" />
            {offline ? (
              <span>
                <strong>{since ? `Your website has been off since ${since}.` : 'Your website is off.'}</strong> Visitors only see the notice below, with a
                few small games to play while they wait. You still see the whole site while you’re signed in.
              </span>
            ) : (
              <span>
                <strong>Your website is on.</strong> Everyone can see it.
              </span>
            )}
          </p>
          <div className="form-grid">
            <div className="field span-2">
              <label htmlFor="offline_title">Notice</label>
              <input
                id="offline_title"
                name="offline_title"
                className="input"
                maxLength={120}
                defaultValue={settings.offline_title || OFFLINE_DEFAULT_TITLE}
                placeholder={OFFLINE_DEFAULT_TITLE}
              />
            </div>
            <div className="field span-2">
              <label htmlFor="offline_note">More detail (optional)</label>
              <textarea
                id="offline_note"
                name="offline_note"
                className="input"
                rows={3}
                maxLength={500}
                defaultValue={settings.offline_note ?? ''}
                placeholder="Back on Monday."
              />
              <p className="hint">
                Shown under the notice, next to a few small games visitors can play. Email addresses and https:// links become links.
                Signing in and unsubscribing from the newsletter keep working while the site is off.
              </p>
            </div>
          </div>
        </fieldset>

        <div className="availability-actions">
          {offline ? (
            <button type="submit" name="intent" value="on" className="btn">
              Switch the website back on
            </button>
          ) : (
            <button type="submit" name="intent" value="off" className="btn">
              Switch the website off
            </button>
          )}
          <button type="submit" name="intent" value="save" className="btn btn-secondary">
            Save notice
          </button>
          <a href={OFFLINE_PREVIEW_PATH} target="_blank" rel="noopener" className="text-link">
            Preview what visitors see
          </a>
        </div>
      </form>

      <form action={updateContact} className="form" style={{ marginTop: 0, marginBottom: 40 }}>
        <fieldset>
          <legend>Contact and press</legend>
          <div className="form-grid">
            <div className="field span-2">
              <label htmlFor="booking_url">Booking link</label>
              <input id="booking_url" name="booking_url" type="url" className="input" defaultValue={settings.booking_url ?? ''} placeholder="https://calendly.com/… or https://cal.com/…" />
              <p className="hint">Your Calendly, Cal.com or Google Calendar booking page. The Book a meeting buttons appear once this is set.</p>
            </div>
            <div className="field">
              <label htmlFor="contact_email">Press email</label>
              <input id="contact_email" name="contact_email" type="email" className="input" defaultValue={settings.contact_email ?? ''} placeholder="press@…" />
              <p className="hint">Shown in the footer under For press.</p>
            </div>
            <div className="field">
              <label htmlFor="press_kit_url">Press kit link</label>
              <input id="press_kit_url" name="press_kit_url" type="url" className="input" defaultValue={settings.press_kit_url ?? ''} placeholder="https://drive.google.com/…" />
              <p className="hint">A Google Drive folder with your bio and photos. Share it as “Anyone with the link”.</p>
            </div>
          </div>
        </fieldset>

        <div>
          <button type="submit" className="btn">
            Save contact details
          </button>
        </div>
      </form>

      <form action={updateSettings} className="form" style={{ marginTop: 0 }}>
        <fieldset>
          <legend>Subscriptions</legend>
          <label className="check" style={{ marginBottom: 14 }}>
            <input type="checkbox" name="subscriptions_enabled" defaultChecked={settings.subscriptions_enabled} />
            <span>
              <strong>Require a subscription for subscriber-only articles.</strong>
              <span className="hint" style={{ display: 'block' }}>
                While this is off, every registered reader can read every article, and no payment is needed.
              </span>
            </span>
          </label>
          <div className="form-grid">
            <div className="field span-2">
              <label htmlFor="plan_name">Plan name</label>
              <input id="plan_name" name="plan_name" className="input" defaultValue={settings.plan_name} maxLength={80} />
            </div>
            <div className="field">
              <label htmlFor="price_amount">Price</label>
              <input id="price_amount" name="price_amount" type="number" min="0" step="0.01" className="input" defaultValue={settings.price_amount} />
            </div>
            <div className="field">
              <label htmlFor="currency">Currency</label>
              <input id="currency" name="currency" className="input" defaultValue={settings.currency} maxLength={3} placeholder="USD" />
            </div>
            <div className="field">
              <label htmlFor="billing_interval">Billed every</label>
              <select id="billing_interval" name="billing_interval" className="input" defaultValue={settings.billing_interval}>
                <option value="month">Month</option>
                <option value="year">Year</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="billing_provider">Billing provider</label>
              <select id="billing_provider" name="billing_provider" className="input" defaultValue={settings.billing_provider}>
                {PROVIDERS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field span-2">
              <label htmlFor="checkout_url">Checkout link</label>
              <input id="checkout_url" name="checkout_url" type="url" className="input" defaultValue={settings.checkout_url ?? ''} placeholder="https://paystack.com/pay/… or https://buy.stripe.com/…" />
              <p className="hint">
                A hosted payment page from your provider, set to the price above. Readers go here after leaving their email in the
                footer sign-up, and from Subscribe. Match payments to emails under Newsletter; activate account holders under Readers.
              </p>
            </div>
            <p className="hint span-2" style={{ margin: 0 }}>
              The Subscribe page’s heading, wording and note are under{' '}
              <Link href="/admin/content#subscribe-page">Site content → Subscribe page</Link>.
            </p>
          </div>
        </fieldset>

        <fieldset>
          <legend>Links</legend>
          <div className="field">
            <label htmlFor="social_links">Social and contact links</label>
            <textarea id="social_links" name="social_links" className="input" rows={4} defaultValue={links} placeholder={`LinkedIn | https://www.linkedin.com/in/…
Email | mailto:hello@chidera.com`} style={{ fontFamily: 'var(--mono)', fontSize: 14 }} />
            <p className="hint">One per line, as “Label | https://…”. They appear in the footer and on the About page, which you edit under About page.</p>
          </div>
        </fieldset>

        <div>
          <button type="submit" className="btn">
            Save settings
          </button>
        </div>
      </form>
    </div>
  )
}
