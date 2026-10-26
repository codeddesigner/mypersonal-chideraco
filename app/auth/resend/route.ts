import { createClient } from '@/lib/supabase/server'
import { forbidden, isSameOrigin, originOf, redirectTo } from '@/lib/http'
import { safeNext } from '@/lib/utils'

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden()
  const form = await request.formData()
  const email = String(form.get('email') ?? '').trim().toLowerCase()
  const next = safeNext(form.get('next'))
  if (!email.includes('@')) return redirectTo(request, '/signup', { error: 'Enter a valid email address.', next })

  const supabase = await createClient()
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: `${originOf(request)}/auth/callback?next=${encodeURIComponent(next)}` },
  })
  // Supabase allows one new code a minute for each address.
  const wait = Boolean(error && /rate limit|security purposes|seconds/i.test(error.message))
  return redirectTo(request, '/verify', {
    email,
    next: next !== '/' ? next : undefined,
    error: wait ? 'Please wait a minute before asking for another code. If you already have one, enter it below.' : undefined,
    message: wait ? undefined : 'If that account is waiting to be confirmed, we’ve sent a new code. Use the newest one.',
  })
}
