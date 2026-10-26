'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function updateDisplayName(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/account')

  const raw = formData.get('display_name')
  const displayName = typeof raw === 'string' ? raw.trim().slice(0, 80) : ''
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: displayName || null })
    .eq('id', user.id)

  redirect(`/account?${new URLSearchParams(error ? { error: 'Your name could not be saved.' } : { message: 'Saved.' })}`)
}
