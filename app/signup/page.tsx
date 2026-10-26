import Link from 'next/link'
import AuthFrame from '@/components/AuthFrame'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { TrackEvent } from '@/components/Analytics'
import GoogleButton from '@/components/GoogleButton'
import { getUser } from '@/lib/auth'
import { googleEnabled } from '@/lib/auth-providers'
import '@/app/signup/oauth.css'
import { buildHref, one, safeNext } from '@/lib/utils'

export const metadata: Metadata = { title: 'Create an account', robots: { index: false } }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function SignupPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const next = safeNext(one(sp.next))
  const error = one(sp.error)
  const message = one(sp.message)
  const email = one(sp.email) ?? ''
  const sent = one(sp.sent) === '1'

  if (await getUser()) redirect(next)
  const google = await googleEnabled()

  // Older links to the "check your email" view now go to the page where the code is entered.
  if (sent) redirect(buildHref('/verify', { email, next: next !== '/' ? next : undefined, message }))

  return (
    <AuthFrame accent="saffron" seed="join-us-2">
      <h1 className="page-title">Create an account</h1>
      <p className="page-sub">Read every article in full, and join the conversation under each one.</p>

      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}

      {google && <GoogleButton next={next} back="signup" />}

      <form className="form" method="post" action="/auth/signup">
        <input type="hidden" name="next" value={next} />
        <div className="field">
          <label htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" autoComplete="email" required defaultValue={email} />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            className="input"
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            aria-describedby="password-hint"
          />
          <p className="hint" id="password-hint">
            At least 8 characters.
          </p>
        </div>
        <button className="btn" type="submit">
          Create account
        </button>
      </form>

      <p className="form-foot">
        Already have an account? <Link href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link>
      </p>
      <TrackEvent name="signup_initiated" />
    </AuthFrame>
  )
}
