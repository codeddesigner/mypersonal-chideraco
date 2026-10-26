import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { track } from '@/lib/analytics'
import { forbidden, isSameOrigin, originOf, redirectTo } from '@/lib/http'
import { safeNext } from '@/lib/utils'

function friendly(error: { message: string; code?: string }): string {
  const { message, code } = error
  if (code === 'user_already_exists' || /already registered|already exists/i.test(message))
    return 'An account with this email already exists. Sign in instead.'
  if (code === 'email_address_invalid') return 'That email address can’t receive mail. Please check it and try again.'
  if (code === 'email_address_not_authorized' || /not authorized/i.test(message) || /sending .*email/i.test(message))
    return 'We couldn’t send your confirmation code just now. Please try again later.'
  if (code === 'over_email_send_rate_limit' || /rate limit/i.test(message))
    return 'Too many attempts right now. Please try again in a little while.'
  if (code === 'weak_password' || /password/i.test(message)) return message
  if (code === 'validation_failed' || /email/i.test(message)) return 'Enter a valid email address.'
  return 'We couldn’t create your account. Please try again.'
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden()
  const form = await request.formData()
  const email = String(form.get('email') ?? '').trim().toLowerCase()
  const password = String(form.get('password') ?? '')
  const next = safeNext(form.get('next'))

  if (!email.includes('@') || email.length > 254) {
    return redirectTo(request, '/signup', { error: 'Enter a valid email address.', next, email })
  }
  if (password.length < 8) {
    return redirectTo(request, '/signup', { error: 'Use at least 8 characters for your password.', next, email })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${originOf(request)}/auth/callback?next=${encodeURIComponent(next)}` },
  })

  if (error) return redirectTo(request, '/signup', { error: friendly(error), next, email })

  await track(supabase, { name: 'account_created', user_id: data.session ? data.user?.id : null, path: next })

  // Email confirmation off: the reader is signed in and goes straight back to the article.
  if (data.session) return NextResponse.redirect(new URL(next, request.url), 303)

  // Email confirmation on: they type the code from the email on /verify, then go back to the same article.
  return redirectTo(request, '/verify', { email, next: next !== '/' ? next : undefined })
}
