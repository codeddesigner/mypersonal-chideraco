import Link from 'next/link'
import AuthFrame from '@/components/AuthFrame'
import type { Metadata } from 'next'
import { getUser } from '@/lib/auth'
import { one } from '@/lib/utils'

export const metadata: Metadata = { title: 'Choose a new password', robots: { index: false } }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const error = one(sp.error)
  const user = await getUser()

  return (
    <AuthFrame accent="blush" seed="reset-3">
      <h1 className="page-title">Choose a new password</h1>
      {!user ? (
        <>
          <p className="page-sub">Your reset has expired, or you’re signed out.</p>
          <p className="form-foot">
            <Link href="/forgot-password">Get a new code</Link>
          </p>
        </>
      ) : (
        <>
          <p className="page-sub">For {user.email}.</p>
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          <form className="form" method="post" action="/auth/reset">
            <div className="field">
              <label htmlFor="password">New password</label>
              <input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
            </div>
            <div className="field">
              <label htmlFor="confirm">Confirm new password</label>
              <input className="input" id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
            </div>
            <button className="btn" type="submit">
              Save password
            </button>
          </form>
        </>
      )}
    </AuthFrame>
  )
}
