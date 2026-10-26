import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { redirectTo } from '@/lib/http'
import { safeNext } from '@/lib/utils'

// Handles links from confirmation and password-reset emails.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null
  // The branded sign-in emails link straight here and carry the page the reader started from inside
  // redirect_to (a link back to this route with its own ?next=). Only that path is used.
  let carried: string | null = null
  try {
    carried = new URL(url.searchParams.get('redirect_to') ?? '').searchParams.get('next')
  } catch {
    carried = null
  }
  const next = safeNext(url.searchParams.get('next') ?? carried)

  const supabase = await createClient()
  let ok = false
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    ok = !error
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    ok = !error
  }

  if (!ok) {
    return redirectTo(request, '/login', {
      message: 'That link has expired or was already used. If you just confirmed your email, sign in to continue.',
      next,
    })
  }

  const destination = type === 'recovery' ? '/reset-password' : next
  return NextResponse.redirect(new URL(destination, request.url))
}
