import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getProfile, getUser } from '@/lib/auth'
import { formatDate } from '@/lib/format'
import { getSettings, getSubscription, isActiveSubscription } from '@/lib/queries'
import { one } from '@/lib/utils'
import { updateDisplayName } from './actions'

export const metadata: Metadata = { title: 'Your account', robots: { index: false } }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function AccountPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const user = await getUser()
  if (!user) redirect('/login?next=/account')

  const [profile, subscription, settings] = await Promise.all([getProfile(), getSubscription(user.id), getSettings()])
  const active = isActiveSubscription(subscription)
  const message = one(sp.message)
  const error = one(sp.error)

  let subscriptionText = 'None'
  if (active) {
    subscriptionText = subscription?.current_period_end
      ? `Active until ${formatDate(subscription.current_period_end)}`
      : 'Active'
  } else if (subscription) {
    const state = subscription.status.replace('_', ' ')
    subscriptionText = subscription.current_period_end
      ? `${state.charAt(0).toUpperCase()}${state.slice(1)}, ended ${formatDate(subscription.current_period_end)}`
      : `${state.charAt(0).toUpperCase()}${state.slice(1)}`
  }

  return (
    <div className="page">
      <div className="narrow wide">
        <h1 className="page-title">Your account</h1>
        {message && (
          <p className="notice success" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}

        <dl className="dl">
          <dt>Email</dt>
          <dd>{user.email}</dd>
          <dt>Reader since</dt>
          <dd>{formatDate(profile?.created_at ?? user.created_at)}</dd>
          <dt>Reading access</dt>
          <dd>{profile?.status === 'suspended' ? 'Suspended' : 'Full articles for registered readers'}</dd>
          <dt>Subscription</dt>
          <dd>
            {subscriptionText}
            {!active && settings.subscriptions_enabled && (
              <Link href="/subscribe" className="text-link dd-action">
                Subscribe
              </Link>
            )}
          </dd>
        </dl>

        <section className="block">
          <h2>Name</h2>
          <form action={updateDisplayName} className="inline">
            <div className="field">
              <label htmlFor="display_name" className="sr-only">
                Name
              </label>
              <input className="input" id="display_name" name="display_name" defaultValue={profile?.display_name ?? ''} placeholder="Optional" maxLength={80} />
            </div>
            <button type="submit" className="btn btn-secondary">
              Save
            </button>
          </form>
        </section>

        <section className="block">
          <h2>Password</h2>
          <Link href="/reset-password" className="link-btn">
            Change your password
          </Link>
        </section>

        <section className="block">
          <form method="post" action="/auth/signout">
            <button type="submit" className="btn btn-secondary">
              Sign out
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
