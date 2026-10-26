import { createHash } from 'crypto'
import { cookies, headers } from 'next/headers'
import { ACCESS_COOKIE, normaliseCode, personalContent, type Hobby } from '@/lib/about'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export type PersonalLife =
  | { open: false; busy: boolean }
  | { open: true; viaAdmin: boolean; personal: string; hobbies: Hobby[] }

export type CodeCheck = { status: 'ok' | 'invalid' | 'locked' | 'error'; personal?: string; hobbies?: Hobby[] }

// Server-only. Identifies a visitor for counting wrong tries, without storing their address.
export async function visitorKey(): Promise<string> {
  const incoming = await headers()
  const address = (incoming.get('x-forwarded-for') ?? '').split(',')[0].trim() || incoming.get('x-real-ip') || 'unknown'
  return createHash('sha256').update(`chidera-about:${address}`).digest('hex').slice(0, 32)
}

// Server-only. Checks a code with the database, which counts wrong tries and pauses when there are too many.
export async function checkCode(code: string, unlock: boolean): Promise<CodeCheck> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('about_personal', { p_code: code, p_client: await visitorKey(), p_unlock: unlock })
  if (error || !data || typeof data !== 'object') return { status: 'error' }
  const status = (data as { status?: string }).status
  if (status === 'ok') return { status: 'ok', ...personalContent(data) }
  return { status: status === 'locked' ? 'locked' : 'invalid' }
}

// Server-only. Personal life is shown to the site's admins, and to visitors whose access code
// (kept in a cookie after they enter it) is still valid. Turning a code off locks it again.
export async function loadPersonalLife(): Promise<PersonalLife> {
  const profile = await getProfile()
  if (profile?.role === 'admin' && profile.status === 'active') {
    const supabase = await createClient()
    const { data } = await supabase.from('about_private').select('personal,hobbies').eq('id', true).maybeSingle()
    if (data) return { open: true, viaAdmin: true, ...personalContent(data) }
  }

  const code = normaliseCode((await cookies()).get(ACCESS_COOKIE)?.value)
  if (!code) return { open: false, busy: false }
  const result = await checkCode(code, false)
  if (result.status === 'ok') return { open: true, viaAdmin: false, personal: result.personal ?? '', hobbies: result.hobbies ?? [] }
  return { open: false, busy: result.status === 'locked' }
}
