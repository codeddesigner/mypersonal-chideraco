import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { track } from '@/lib/analytics'
import { forbidden, isSameOrigin, redirectTo } from '@/lib/http'

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return redirectTo(request, '/login', { next: '/subscribe' })

  const { data } = await supabase
    .from('site_settings')
    .select('subscriptions_enabled,checkout_url')
    .eq('id', true)
    .maybeSingle()
  const settings = data as unknown as { subscriptions_enabled: boolean; checkout_url: string | null } | null

  if (!settings?.subscriptions_enabled || !settings.checkout_url) {
    return redirectTo(request, '/subscribe', { message: 'Subscriptions aren’t available just yet.' })
  }

  await track(supabase, { name: 'subscription_initiated', user_id: user.id, path: '/subscribe' })

  const checkout = new URL(settings.checkout_url)
  if (!checkout.searchParams.has('prefilled_email') && checkout.hostname.endsWith('stripe.com')) {
    checkout.searchParams.set('prefilled_email', user.email ?? '')
  }
  return NextResponse.redirect(checkout, 303)
}
