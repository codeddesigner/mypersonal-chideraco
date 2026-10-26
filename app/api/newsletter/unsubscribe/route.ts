import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isUuid } from '@/lib/utils'

export const dynamic = 'force-dynamic'

// One-click unsubscribe (RFC 8058). Every newsletter carries this address in its List-Unsubscribe header, and
// email programs such as Gmail, Yahoo and Apple Mail post to it when the reader presses their Unsubscribe button.
// The code in the address is the only thing that identifies the subscriber.
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? ''
  if (!isUuid(token)) return new NextResponse('Unknown unsubscribe link.', { status: 400 })
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('newsletter_unsubscribe', { p_token: token })
  if (error) return new NextResponse('Something went wrong. Please try again.', { status: 500 })
  if (data === 'unknown') return new NextResponse('Unknown unsubscribe link.', { status: 404 })
  return new NextResponse('You’re unsubscribed.', { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}

// Opening the address in a browser shows the normal unsubscribe page, which asks before doing anything.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? ''
  return NextResponse.redirect(new URL(isUuid(token) ? `/unsubscribe/${token}` : '/unsubscribe', request.url), 303)
}
