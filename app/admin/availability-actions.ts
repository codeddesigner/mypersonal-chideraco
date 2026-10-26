'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { OFFLINE_DEFAULT_TITLE } from '@/lib/offline'
import { createClient } from '@/lib/supabase/server'

const str = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value : '')

function back(params: Record<string, string>): never {
  redirect(`/admin/settings?${new URLSearchParams(params)}`)
}

// Switches the website off or back on, and saves the notice visitors see while it's off.
// The button pressed decides: "off", "on", or "save" (keep it as it is and only save the wording).
export async function updateAvailability(formData: FormData) {
  await requireAdmin()
  const intent = str(formData.get('intent'))
  const title = str(formData.get('offline_title')).replace(/\s+/g, ' ').trim().slice(0, 120) || OFFLINE_DEFAULT_TITLE
  const note = str(formData.get('offline_note')).replace(/\r\n?/g, '\n').trim().slice(0, 500)

  const supabase = await createClient()
  const { data: current, error: readError } = await supabase.from('site_settings').select('site_offline').eq('id', true).maybeSingle()
  if (readError) back({ error: readError.message })
  const wasOffline = (current as { site_offline?: boolean } | null)?.site_offline === true
  const offline = intent === 'off' ? true : intent === 'on' ? false : wasOffline

  const { error } = await supabase
    .from('site_settings')
    .update({
      site_offline: offline,
      offline_title: title,
      offline_note: note,
      ...(offline !== wasOffline ? { offline_since: offline ? new Date().toISOString() : null } : {}),
    })
    .eq('id', true)
  if (error) back({ error: error.message })

  revalidatePath('/', 'layout')
  if (offline && !wasOffline) back({ message: 'Your website is off. Visitors now see the notice instead.' })
  if (!offline && wasOffline) back({ message: 'Your website is back on. Everyone can see it again.' })
  back({ message: 'Notice saved.' })
}
