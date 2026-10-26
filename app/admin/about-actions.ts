'use server'

import { randomInt } from 'crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cleanList, normaliseCode, type AboutListName } from '@/lib/about'
import { requireAdmin } from '@/lib/auth'
import { joinLines, toLines } from '@/lib/content'
import { createClient } from '@/lib/supabase/server'
import { isUuid } from '@/lib/utils'

const str = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value.trim() : '')

function back(params: Record<string, string>, hash = ''): never {
  redirect(`/admin/about?${new URLSearchParams(params)}${hash}`)
}

// Each list arrives as JSON from its editor. Anything malformed is dropped rather than saved.
function readList(formData: FormData, name: AboutListName): Record<string, string>[] | null {
  const raw = str(formData.get(name))
  if (!raw) return []
  try {
    return cleanList(JSON.parse(raw), name)
  } catch {
    return null
  }
}

// Saves every section of the About page. Personal life goes to the private table.
export async function updateAbout(formData: FormData) {
  await requireAdmin()
  const body = str(formData.get('about_body')).slice(0, 20000)
  const personal = str(formData.get('about_personal')).slice(0, 12000)
  const clients = toLines(str(formData.get('about_clients')), 40).map((name) => name.slice(0, 70))
  const photoUrl = str(formData.get('about_photo_url')).slice(0, 500)
  const photoAlt = str(formData.get('about_photo_alt')).slice(0, 200)
  // Line breaks typed in admin are kept, and the page shows them in the same places.
  const statement = joinLines(toLines(str(formData.get('about_statement')), 6)).slice(0, 300)
  const credential = joinLines(toLines(str(formData.get('about_credential')), 3)).slice(0, 160)

  if (photoUrl && !photoUrl.startsWith('https://')) back({ error: 'The photo must be an https:// image link.' })

  const lists: Partial<Record<AboutListName, Record<string, string>[]>> = {}
  for (const name of ['about_services', 'about_experience', 'about_education', 'about_hobbies', 'about_figures'] as AboutListName[]) {
    const list = readList(formData, name)
    if (list === null) back({ error: 'One of the lists didn’t come through. Reload the page and try again.' })
    lists[name] = list
  }
  // Logos must be uploaded pictures (https links); anything else is cleared.
  const experience = (lists.about_experience ?? []).map((item) => ({ ...item, logo: item.logo.startsWith('https://') ? item.logo : '' }))

  const supabase = await createClient()
  const { error } = await supabase
    .from('site_settings')
    .update({
      about_body: body,
      about_clients: joinLines(clients) || null,
      about_photo_url: photoUrl || null,
      about_photo_alt: photoAlt || null,
      about_services: lists.about_services ?? [],
      about_experience: experience,
      about_education: lists.about_education ?? [],
      about_statement: statement || null,
      about_credential: credential || null,
      about_figures: lists.about_figures ?? [],
    })
    .eq('id', true)
  if (error) back({ error: error.message })

  // Personal life is only in the form when it loaded; otherwise it is left as it was.
  if (formData.has('about_hobbies')) {
    const { error: privateError } = await supabase
      .from('about_private')
      .update({ personal: personal || null, hobbies: lists.about_hobbies ?? [] })
      .eq('id', true)
    if (privateError) back({ error: `Saved, except Personal life: ${privateError.message}` })
  }

  revalidatePath('/', 'layout')
  back({ message: 'About page saved. It’s live now.' })
}

/* Access codes for Personal life ----------------------------------------------- */

// I and O are left out so codes can't be misread as 1 and 0.
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const randomCode = () => Array.from({ length: 5 }, () => LETTERS.charAt(randomInt(LETTERS.length))).join('')

const EXPIRY_DAYS: Record<string, number> = { '7': 7, '30': 30, '90': 90, '365': 365 }

export async function issueAccessCode(formData: FormData) {
  await requireAdmin()
  const label = str(formData.get('label')).slice(0, 80)
  const wanted = str(formData.get('code'))
  const chosen = normaliseCode(wanted)
  if (wanted && !chosen) back({ codeError: 'A code is exactly five letters, A to Z.' }, '#access-codes')

  const days = EXPIRY_DAYS[str(formData.get('expires'))]
  const expires = days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString() : null

  const supabase = await createClient()
  // A random code is tried a few times in the unlikely case it's already taken.
  for (let attempt = 0; attempt < (chosen ? 1 : 6); attempt++) {
    const code = chosen || randomCode()
    const { error } = await supabase.from('about_access_codes').insert({ code, label, expires_at: expires })
    if (!error) {
      revalidatePath('/admin/about')
      back({ codeMessage: `Code ${code} is ready${label ? ` for ${label}` : ''}. Share it with them.`, issued: code }, '#access-codes')
    }
    if (error.code !== '23505') back({ codeError: error.message }, '#access-codes')
    if (chosen) back({ codeError: `${code} is already in use. Choose different letters.` }, '#access-codes')
  }
  back({ codeError: 'Couldn’t find a free code. Try again.' }, '#access-codes')
}

export async function revokeAccessCode(formData: FormData) {
  await requireAdmin()
  const id = str(formData.get('id'))
  if (!isUuid(id)) back({ codeError: 'Unknown code.' }, '#access-codes')
  const supabase = await createClient()
  const { error } = await supabase.from('about_access_codes').update({ revoked_at: new Date().toISOString() }).eq('id', id)
  if (error) back({ codeError: error.message }, '#access-codes')
  revalidatePath('/admin/about')
  back({ codeMessage: 'Code turned off.' }, '#access-codes')
}

export async function deleteAccessCode(formData: FormData) {
  await requireAdmin()
  const id = str(formData.get('id'))
  if (!isUuid(id)) back({ codeError: 'Unknown code.' }, '#access-codes')
  const supabase = await createClient()
  const { error } = await supabase.from('about_access_codes').delete().eq('id', id)
  if (error) back({ codeError: error.message }, '#access-codes')
  revalidatePath('/admin/about')
  back({ codeMessage: 'Code deleted.' }, '#access-codes')
}
