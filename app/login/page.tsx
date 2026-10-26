import Link from 'next/link'
import AuthFrame from '@/components/AuthFrame'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import GoogleButton from '@/components/GoogleButton'
import { getUser } from '@/lib/auth'
import { googleEnabled } from '@/lib/auth-providers'
import '@/app/signup/oauth.css'
import { one, safeNext } from '@/lib/utils'

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const next = safeNext(one(sp.next))
  const error = one(sp.error)
  const message = one(sp.message)
  const email = one(sp.email) ?? ''
  const unconfirmed = one(sp.unconfirmed) === '1'

  if (await getUser()) redirect(next)
  const google = await googleEnabled()

  return (
    <AuthFrame accent="pool" seed="sign-in-1">
      <h1 className="page-title">Sign in</h1>
      <p className="page-sub">Welcome back.</p>

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

      {google && <GoogleButton next={next} back="login" />}

      <form className="form" method="post" action="/auth/login">
        <input type="hidden" name="next" value={next} />
        <div className="field">
          <label htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" autoComplete="email" required defaultValue={email} />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <button className="btn" type="submit">
          Sign in
        </button>
      </form>

      {unconfirmed && email && (
        <form method="post" action="/auth/resend" className="form-foot">
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="next" value={next} />
          <button type="submit" className="link-btn">
            Resend the confirmation email
          </button>
        </form>
      )}

      <p className="form-foot">
        <Link href="/forgot-password">Forgot your password?</Link>
      </p>
      <p className="form-foot">
        New here? <Link href={`/signup?next=${encodeURIComponent(next)}`}>Create an account</Link>
      </p>
    </AuthFrame>
  )
}
