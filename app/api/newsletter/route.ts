import { NextResponse } from 'next/server'
import { paymentLink } from '@/lib/checkout'
import { forbidden, isSameOrigin } from '@/lib/http'
import { createClient } from '@/lib/supabase/server'

const JOINED = 'You’re on the list. Payment opens soon, and you’ll get the link by email.'
const ALREADY = 'You’re already on the list. Payment opens soon, and you’ll get the link by email.'
const REJOINED = 'Welcome back. You’re on the list again.'
const TO_PAYMENT = 'Taking you to payment…'
const INVALID = 'Enter a valid email address.'
const FAILED = 'That didn’t go through. Please try again in a moment.'

function looksLikeEmail(value: string) {
  const at = value.indexOf('@')
  return at > 0 && at === value.lastIndexOf('@') && value.lastIndexOf('.') > at + 1 && !value.endsWith('.') && !/[ ,;<>]/.test(value)
}

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

// The paid sign-up for new articles. It saves the email, then sends the reader on to
// the payment link from Admin → Settings. Until there is a link, the email is kept for later.
// The footer form calls it with JSON; without JavaScript the form posts here directly.
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden()

  const isJson = (request.headers.get('content-type') ?? '').includes('application/json')
  let fields: Record<string, unknown> = {}
  try {
    fields = isJson ? await request.json() : Object.fromEntries(await request.formData())
  } catch {
    fields = {}
  }

  const reply = (status: number, message: string) =>
    isJson
      ? NextResponse.json({ message }, { status })
      : NextResponse.redirect(new URL(`/subscribe?newsletter=${status === 200 ? 'joined' : 'error'}`, request.url), 303)

  // A filled-in hidden field means a bot. Answer as if it worked.
  if (text(fields.company)) return reply(200, JOINED)

  const email = text(fields.email).toLowerCase().slice(0, 254)
  if (!looksLikeEmail(email)) return reply(400, INVALID)

  // The database function saves the address once, and brings back someone who had unsubscribed.
  const supabase = await createClient()
  const { data: outcome, error } = await supabase.rpc('newsletter_subscribe', {
    p_email: email,
    p_source: text(fields.source).slice(0, 40) || null,
  })
  if (error) return reply(500, FAILED)
  if (outcome === 'invalid') return reply(400, INVALID)
  const already = outcome === 'already'

  // Someone already on the list may be coming back to finish paying, so they go on too.
  const { data } = await supabase.from('site_settings').select('checkout_url').eq('id', true).maybeSingle()
  const checkout = paymentLink((data as { checkout_url?: string | null } | null)?.checkout_url, email)
  if (checkout) {
    return isJson ? NextResponse.json({ message: TO_PAYMENT, redirect: checkout }) : NextResponse.redirect(checkout, 303)
  }
  return reply(200, already ? ALREADY : outcome === 'rejoined' ? REJOINED : JOINED)
}
