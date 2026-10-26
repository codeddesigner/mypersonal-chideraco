'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

const str = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value.trim() : '')

function looksLikeEmail(value: string) {
  const at = value.indexOf('@')
  return at > 0 && at === value.lastIndexOf('@') && value.lastIndexOf('.') > at + 1 && !value.endsWith('.') && !/[ ,;]/.test(value)
}

function back(params: Record<string, string>): never {
  redirect(`/admin/settings?${new URLSearchParams(params)}`)
}

// Booking link, press email and press kit. Each is optional; the site shows a link once it is set.
export async function updateContact(formData: FormData) {
  await requireAdmin()
  const booking = str(formData.get('booking_url'))
  const pressKit = str(formData.get('press_kit_url'))
  const email = str(formData.get('contact_email')).replace(/^mailto:/i, '')

  if (booking && !booking.startsWith('https://')) back({ error: 'The booking link must start with https://' })
  if (pressKit && !pressKit.startsWith('https://')) back({ error: 'The press kit link must start with https://' })
  if (email && !looksLikeEmail(email)) back({ error: 'Enter a valid press email address.' })

  const supabase = await createClient()
  const { error } = await supabase
    .from('site_settings')
    .update({
      booking_url: booking.slice(0, 500) || null,
      press_kit_url: pressKit.slice(0, 500) || null,
      contact_email: email.slice(0, 200) || null,
    })
    .eq('id', true)
  if (error) back({ error: error.message })
  revalidatePath('/', 'layout')
  back({ message: 'Contact and press details saved.' })
}
