import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { forbidden, isSameOrigin, redirectTo } from '@/lib/http'
import { safeNext } from '@/lib/utils'

// Checks the code from a sign-up or password-reset email (see /verify) and signs the reader in.
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden()
  const form = await request.formData()
  const email = String(form.get('email') ?? '').trim().toLowerCase()
  // People paste codes with spaces or dashes; only the digits count.
  const code = String(form.get('code') ?? '').replace(/[^0-9]/g, '')
  const recovery = String(form.get('kind') ?? '') === 'recovery'
  const next = safeNext(form.get('next'))

  const back = (error: string) =>
    redirectTo(request, '/verify', { kind: recovery ? 'recovery' : undefined, email, next: next !== '/' ? next : undefined, error })

  if (!email.includes('@')) return back('Enter the email address the code was sent to.')
  if (code.length < 6 || code.length > 10) return back('Enter the whole code from the email.')

  const supabase = await createClient()
  const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: recovery ? 'recovery' : 'email' })
  if (error || !data.session) {
    const limited = /rate limit|too many/i.test(error?.message ?? '')
    return back(
      limited
        ? 'Too many tries. Wait a few minutes, then try again.'
        : 'That code isn’t right, or it has expired. Check the newest email, or send a new code.'
    )
  }

  return NextResponse.redirect(new URL(recovery ? '/reset-password' : next, request.url), 303)
}
