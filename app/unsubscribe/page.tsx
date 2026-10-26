import Link from 'next/link'
import type { Metadata } from 'next'
import AuthFrame from '@/components/AuthFrame'

export const metadata: Metadata = { title: 'Unsubscribe', robots: { index: false, follow: false } }

// Reached from an unsubscribe link with no code, such as the one in a test email.
export default function UnsubscribeHelp() {
  return (
    <div data-page="unsubscribe">
      <AuthFrame accent="pool" seed="unsubscribe-1" line="You can come back any time.">
        <h1 className="page-title">Unsubscribe</h1>
        <p className="page-sub">
          Every newsletter has its own Unsubscribe link at the bottom, made for the person it was sent to. Use that link to stop getting
          them. (Test emails sent from the admin have a sample link that leads here.)
        </p>
        <p className="form-foot">
          <Link href="/">Go to the site</Link>
        </p>
      </AuthFrame>
    </div>
  )
}
