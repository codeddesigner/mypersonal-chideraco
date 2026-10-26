import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import AuthFrame from '@/components/AuthFrame'
import { getUser } from '@/lib/auth'
import { one, safeNext } from '@/lib/utils'

export const metadata: Metadata = { title: 'Enter your code', robots: { index: false } }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

// Where readers type the code from a sign-up or password-reset email.
export default async function VerifyPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const recovery = one(sp.kind) === 'recovery'
  const next = safeNext(one(sp.next))
  const email = (one(sp.email) ?? '').trim().toLowerCase()
  const error = one(sp.error)
  const message = one(sp.message)

  // Someone already signed in has no email to confirm. A password reset still goes on, to set the new password.
  if (!recovery && (await getUser())) redirect(next)

  return (
    <AuthFrame accent={recovery ? 'blush' : 'saffron'} seed={recovery ? 'reset-3' : 'join-us-2'}>
      <h1 className="page-title">{recovery ? 'Enter your reset code' : 'Confirm your email'}</h1>
      <p className="page-sub">
        {email ? (
          <>
            We’ve emailed a code to <strong>{email}</strong>.
          </>
        ) : (
          'We’ve emailed you a code.'
        )}{' '}
        {recovery
          ? 'Enter it here to choose a new password.'
          : `Enter it here to finish creating your account${next !== '/' ? ' and go back to the article you were reading' : ''}.`}
      </p>

      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}

      <form className="form" method="post" action="/auth/verify">
        <input type="hidden" name="kind" value={recovery ? 'recovery' : 'signup'} />
        <input type="hidden" name="next" value={next} />
        {email ? (
          <input type="hidden" name="email" value={email} />
        ) : (
          <div className="field">
            <label htmlFor="email">Email</label>
            <input className="input" id="email" name="email" type="email" autoComplete="email" required />
          </div>
        )}
        <div className="field">
          <label htmlFor="code">Code</label>
          <input
            className="input"
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            minLength={6}
            maxLength={12}
            required
            autoFocus
            style={{ fontSize: 24, letterSpacing: '0.25em', fontVariantNumeric: 'tabular-nums' }}
          />
        </div>
        <button className="btn" type="submit">
          {recovery ? 'Continue' : 'Confirm email'}
        </button>
      </form>

      {email && (
        <form method="post" action={recovery ? '/auth/forgot' : '/auth/resend'} className="form-foot">
          <input type="hidden" name="email" value={email} />
          {!recovery && <input type="hidden" name="next" value={next} />}
          Didn’t get it? Check your spam folder, or{' '}
          <button type="submit" className="link-btn">
            send a new code
          </button>
          .
        </form>
      )}

      <p className="form-foot">
        {recovery ? (
          <Link href="/login">Back to sign in</Link>
        ) : (
          <>
            Wrong email? <Link href={`/signup?next=${encodeURIComponent(next)}`}>Start again</Link>
          </>
        )}
      </p>
    </AuthFrame>
  )
}
