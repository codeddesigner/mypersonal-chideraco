import { NextResponse } from 'next/server'
import { getSettings } from '@/lib/queries'

export const dynamic = 'force-dynamic'

// chidera.co/book sends visitors to the booking page set in Admin → Settings.
// Until one is set, it opens an email to the press address, or falls back to the About page.
export async function GET(request: Request) {
  const settings = await getSettings()
  if (settings.booking_url) return NextResponse.redirect(settings.booking_url, 307)
  if (settings.contact_email) {
    return NextResponse.redirect(`mailto:${settings.contact_email}?subject=${encodeURIComponent('Meeting request')}`, 307)
  }
  return NextResponse.redirect(new URL('/about', request.url), 307)
}
