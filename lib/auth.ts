import { cache } from 'react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/types'

export const getUser = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  return data.user ?? null
})

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser()
  if (!user) return null
  const supabase = await createClient()
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
  return (data as unknown as Profile | null) ?? null
})

// The admin area is invisible to everyone else. The database enforces the same rule.
export async function requireAdmin(): Promise<Profile> {
  const profile = await getProfile()
  if (!profile || profile.role !== 'admin' || profile.status !== 'active') notFound()
  return profile
}
