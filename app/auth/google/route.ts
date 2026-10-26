import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { forbidden, isSameOrigin, originOf, redirectTo } from '@/lib/http'
import { safeNext } from '@/lib/utils'

// Sends the reader to Google. Google sends them back to /auth/callback, which signs them in
// (creating their account the first time) and returns them to where they were.
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden()
  const form = await request.formData()
  const next = safeNext(form.get('next'))
  const back = form.get('back') === 'signup' ? '/signup' : '/login'

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${originOf(request)}/auth/callback?next=${encodeURIComponent(next)}` },
  })
  if (error || !data?.url) {
    return redirectTo(request, back, { error: 'Google sign-in isn’t available right now. Use your email address instead.', next })
  }
  return NextResponse.redirect(data.url, 303)
}
