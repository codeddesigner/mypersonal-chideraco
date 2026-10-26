import Link from 'next/link'

export type GateReason = 'signin' | 'subscribe' | 'inactive'

export default function AuthPrompt({ reason, next }: { reason: GateReason; next: string }) {
  const encoded = encodeURIComponent(next)

  if (reason === 'subscribe') {
    return (
      <aside className="gate" aria-labelledby="gate-title">
        <h2 id="gate-title">This article is for subscribers.</h2>
        <p>Subscribe to read the rest, and every article after it.</p>
        <div className="gate-actions">
          <Link href={`/subscribe?next=${encoded}`} className="btn">
            Subscribe
          </Link>
          <Link href="/account" className="text-link">
            Your account
          </Link>
        </div>
      </aside>
    )
  }

  if (reason === 'inactive') {
    return (
      <aside className="gate" aria-labelledby="gate-title">
        <h2 id="gate-title">Your account doesn’t have reading access right now.</h2>
        <p>If you think this is a mistake, please get in touch.</p>
        <div className="gate-actions">
          <Link href="/account" className="text-link">
            Your account
          </Link>
        </div>
      </aside>
    )
  }

  return (
    <aside className="gate" aria-labelledby="gate-title">
      <h2 id="gate-title">Keep reading with a free account.</h2>
      <p>The full article is for registered readers. It takes an email address and a password.</p>
      <div className="gate-actions">
        <Link href={`/signup?next=${encoded}`} className="btn" data-event="signup_initiated">
          Create account
        </Link>
        <Link href={`/login?next=${encoded}`} className="text-link">
          Sign in
        </Link>
      </div>
    </aside>
  )
}
