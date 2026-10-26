import Link from 'next/link'
import type { Metadata } from 'next'
import AuthFrame from '@/components/AuthFrame'
import { site } from '@/lib/site'
import { createClient } from '@/lib/supabase/server'
import { isUuid, one } from '@/lib/utils'
import { unsubscribe } from '../actions'

export const metadata: Metadata = { title: 'Unsubscribe', robots: { index: false, follow: false } }

type Params = Promise<{ token: string }>
type SearchParams = Promise<Record<string, string | string[] | undefined>>

// Where the Unsubscribe link in every newsletter leads. It asks first rather than unsubscribing on the spot,
// because some email programs open links to check them, and that shouldn't unsubscribe anyone.
export default async function UnsubscribePage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { token } = await params
  const sp = await searchParams
  const failed = one(sp.error) === '1'

  let found: { masked_email: string; status: string } | null = null
  if (isUuid(token)) {
    const supabase = await createClient()
    const { data } = await supabase.rpc('newsletter_lookup', { p_token: token })
    found = ((data ?? []) as { masked_email: string; status: string }[])[0] ?? null
  }

  return (
    <div data-page="unsubscribe">
      <AuthFrame accent="pool" seed="unsubscribe-1" line="You can come back any time.">
        {!found ? (
          <>
            <h1 className="page-title">Link not recognised</h1>
            <p className="page-sub">
              This unsubscribe link doesn’t match anyone on the list. It may have been copied only in part, or you may already have
              signed up again with a new link. Use the Unsubscribe link at the bottom of the latest newsletter.
            </p>
          </>
        ) : found.status === 'unsubscribed' ? (
          <>
            <h1 className="page-title">You’re unsubscribed</h1>
            <p className="page-sub">
              {found.masked_email} won’t get any more newsletters from {site.brand}. Thank you for reading.
            </p>
            <p className="form-foot">
              Changed your mind? <Link href="/subscribe">Subscribe again</Link>.
            </p>
          </>
        ) : (
          <>
            <h1 className="page-title">Unsubscribe?</h1>
            <p className="page-sub">
              {found.masked_email} will stop getting newsletters from {site.brand}. You can subscribe again whenever you like.
            </p>
            {failed && (
              <p className="notice error" role="alert">
                That didn’t go through. Please try again in a moment.
              </p>
            )}
            <form action={unsubscribe} style={{ marginTop: 28 }}>
              <input type="hidden" name="token" value={token} />
              <button type="submit" className="btn">
                Unsubscribe
              </button>
            </form>
            <p className="form-foot">
              <Link href="/">Keep my subscription and go to the site</Link>
            </p>
          </>
        )}
      </AuthFrame>
    </div>
  )
}
