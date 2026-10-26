import Link from 'next/link'
import AuthFrame from '@/components/AuthFrame'
import type { Metadata } from 'next'
import NewsletterForm from '@/components/NewsletterForm'
import Prose from '@/components/Prose'
import { getUser } from '@/lib/auth'
import { subscribeContent } from '@/lib/content'
import './subscribe.css'
import { formatDate, formatPrice } from '@/lib/format'
import { getSettings, getSubscription, isActiveSubscription } from '@/lib/queries'
import { one, safeNext } from '@/lib/utils'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Subscribe',
  description: 'Support Chidera Nwanyemike’s writing, read every article in full and get new ones by email.',
  path: '/subscribe',
})

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function SubscribePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const next = safeNext(one(sp.next), '/articles')
  const message = one(sp.message)
  const newsletter = one(sp.newsletter)
  const [user, settings] = await Promise.all([getUser(), getSettings()])
  const subscription = user ? await getSubscription(user.id) : null
  const active = isActiveSubscription(subscription)
  const encoded = encodeURIComponent('/subscribe')
  const copy = subscribeContent(settings)
  // The note under the price, written in Admin → Site content.
  const note = copy.note ? (
    <section className="block">
      <Prose source={copy.note} />
    </section>
  ) : null

  return (
    // data-page hides the footer's sign-up box here, since this page is the sign-up (see subscribe.css).
    <div data-page="subscribe">
    <AuthFrame accent="saffron" seed="subscribe-4" line={copy.artLine}>
      <h1 className="page-title">{copy.heading}</h1>

      {!settings.subscriptions_enabled ? (
        <>
          <p className="page-sub">
            {copy.intro}{' '}
            {settings.checkout_url
              ? 'Leave your email, then pay on the next page.'
              : 'Leave your email and you’ll get the payment link as soon as it opens.'}
          </p>
          <p className="price">
            {formatPrice(settings.price_amount, settings.currency)}
            <span className="price-per">/{settings.billing_interval}</span>
          </p>
          {note}
          {newsletter === 'joined' && (
            <p className="notice success" role="status">
              You’re on the list. Payment opens soon, and you’ll get the link by email.
            </p>
          )}
          {newsletter === 'error' && (
            <p className="notice error" role="alert">
              That didn’t go through. Check the email address and try again.
            </p>
          )}
          <div className="subscribe-newsletter">
            <NewsletterForm source="subscribe" />
          </div>
          <p className="form-foot">
            {user ? (
              <Link href="/articles">Read the articles</Link>
            ) : (
              <>
                <Link href={`/signup?next=${encodeURIComponent(next)}`}>Create a free account</Link> to read every article in full.
              </>
            )}
          </p>
        </>
      ) : (
        <>
          <p className="page-sub">{copy.intro}</p>
          <p className="price">
            {formatPrice(settings.price_amount, settings.currency)}
            <span className="price-per">/{settings.billing_interval}</span>
          </p>
          <p className="note">{settings.plan_name}</p>

          {message && (
            <p className="notice" role="status">
              {message}
            </p>
          )}

          {note}

          <section className="block">
            {active ? (
              <p>
                You’re subscribed
                {subscription?.current_period_end ? ` until ${formatDate(subscription.current_period_end)}` : ''}. Thank you.{' '}
                <Link href={next} className="link-btn">
                  Continue reading
                </Link>
              </p>
            ) : !user ? (
              <div className="gate-actions">
                <Link href={`/signup?next=${encoded}`} className="btn">
                  Create an account
                </Link>
                <span className="muted">
                  or{' '}
                  <Link href={`/login?next=${encoded}`} className="text-link">
                    sign in
                  </Link>{' '}
                  to subscribe.
                </span>
              </div>
            ) : settings.checkout_url ? (
              <form method="post" action="/subscribe/start">
                <button type="submit" className="btn">
                  Continue to payment
                </button>
                <p className="hint">Use {user.email} at checkout so the subscription is linked to your account.</p>
              </form>
            ) : (
              <p className="muted">Payment details will be available here soon.</p>
            )}
          </section>
        </>
      )}
    </AuthFrame>
    </div>
  )
}
