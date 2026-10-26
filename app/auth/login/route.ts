import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { track } from '@/lib/analytics'
import { forbidden, isSameOrigin, redirectTo } from '@/lib/http'
import { safeNext } from '@/lib/utils'

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden()
  const form = await request.formData()
  const email = String(form.get('email') ?? '').trim().toLowerCase()
  const password = String(form.get('password') ?? '')
  const next = safeNext(form.get('next'))

  if (!email || !password) {
    return redirectTo(request, '/login', { error: 'Enter your email and password.', next, email })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    const unconfirmed = /confirm/i.test(error?.message ?? '')
    // Not confirmed yet: the code page, where a new code is one press away.
    if (unconfirmed) {
      return redirectTo(request, '/verify', {
        email,
        next: next !== '/' ? next : undefined,
        error: 'Confirm your email first. Enter the code we emailed you, or send a new one.',
      })
    }
    return redirectTo(request, '/login', { error: 'That email and password don’t match an account.', next, email })
  }

  await track(supabase, { name: 'signin_completed', user_id: data.user.id, path: next })
  return NextResponse.redirect(new URL(next, request.url), 303)
}
