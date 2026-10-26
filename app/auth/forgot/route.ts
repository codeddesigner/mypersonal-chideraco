import { createClient } from '@/lib/supabase/server'
import { forbidden, isSameOrigin, originOf, redirectTo } from '@/lib/http'

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden()
  const form = await request.formData()
  const email = String(form.get('email') ?? '').trim().toLowerCase()
  if (!email.includes('@')) return redirectTo(request, '/forgot-password', { error: 'Enter the email address you signed up with.' })

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${originOf(request)}/auth/callback?next=/reset-password`,
  })
  // Supabase allows one new code a minute for each address.
  if (error && /rate limit|security purposes|seconds/i.test(error.message)) {
    return redirectTo(request, '/verify', {
      kind: 'recovery',
      email,
      error: 'Please wait a minute before asking for another code. If you already have one, enter it below.',
    })
  }
  // Same response whether or not the account exists.
  return redirectTo(request, '/verify', { kind: 'recovery', email })
}
