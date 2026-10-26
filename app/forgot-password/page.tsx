import Link from 'next/link'
import AuthFrame from '@/components/AuthFrame'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { buildHref, one } from '@/lib/utils'

export const metadata: Metadata = { title: 'Reset your password', robots: { index: false } }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function ForgotPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const error = one(sp.error)
  const email = one(sp.email) ?? ''
  // Older links to the "sent" view now go to the page where the code is entered.
  if (one(sp.sent) === '1') redirect(buildHref('/verify', { kind: 'recovery', email }))

  return (
    <AuthFrame accent="blush" seed="reset-3">
      <h1 className="page-title">Reset your password</h1>
      <p className="page-sub">Enter your email and we’ll send you a code to choose a new password.</p>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <form className="form" method="post" action="/auth/forgot">
        <div className="field">
          <label htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" autoComplete="email" required defaultValue={email} />
        </div>
        <button className="btn" type="submit">
          Send code
        </button>
      </form>
      <p className="form-foot">
        <Link href="/login">Back to sign in</Link>
      </p>
    </AuthFrame>
  )
}
