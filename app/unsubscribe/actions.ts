'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isUuid } from '@/lib/utils'

// The Unsubscribe button on the page the email's link opens. The link's code is the only thing that
// identifies the subscriber, and the database function only ever changes that one subscriber.
export async function unsubscribe(formData: FormData) {
  const token = String(formData.get('token') ?? '')
  if (!isUuid(token)) redirect('/unsubscribe')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('newsletter_unsubscribe', { p_token: token })
  if (error) redirect(`/unsubscribe/${token}?error=1`)
  redirect(`/unsubscribe/${token}?done=${data === 'unknown' ? 'unknown' : '1'}`)
}
