'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { SUBSCRIBE_DEFAULTS, joinLines, toLines } from '@/lib/content'
import { createClient } from '@/lib/supabase/server'

const str = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value.trim() : '')

function back(params: Record<string, string>): never {
  redirect(`/admin/content?${new URLSearchParams(params)}`)
}

// Home page heading, photo, portrait, the Subscribe page's words, footer description and sign-up heading.
// Anything left empty goes back to the text the site shipped with.
export async function updateContent(formData: FormData) {
  await requireAdmin()
  const hero = toLines(str(formData.get('hero_lines')), 4).map((line) => line.slice(0, 80))
  const heading = toLines(str(formData.get('newsletter_heading')), 3).map((line) => line.slice(0, 90))
  // Line breaks typed in admin are kept everywhere below; the site shows them in the same places.
  const about = joinLines(toLines(str(formData.get('footer_about')), 12)).slice(0, 600)
  const portraitUrl = str(formData.get('portrait_url')).slice(0, 500)
  const portraitAlt = str(formData.get('portrait_alt')).slice(0, 200)
  const photoUrl = str(formData.get('hero_photo_url')).slice(0, 500)
  const photoAlt = str(formData.get('hero_photo_alt')).slice(0, 200)
  // The Subscribe page's wording. Text left as the original is stored as empty, so the original keeps
  // following the site (the line under the heading changes when paid subscriptions are switched on).
  const unlessDefault = (value: string, ...defaults: string[]) => (defaults.includes(value) ? '' : value)
  const subscribeHeading = unlessDefault(joinLines(toLines(str(formData.get('subscribe_heading')), 3)).slice(0, 80), SUBSCRIBE_DEFAULTS.heading)
  const subscribeIntro = unlessDefault(
    joinLines(toLines(str(formData.get('subscribe_intro')), 6)).slice(0, 300),
    SUBSCRIBE_DEFAULTS.intro,
    SUBSCRIBE_DEFAULTS.introPaid
  )
  const subscribeArtLine = unlessDefault(joinLines(toLines(str(formData.get('subscribe_art_line')), 4)).slice(0, 140), SUBSCRIBE_DEFAULTS.artLine)
  const subscribeNote = str(formData.get('subscribe_note')).slice(0, 4000)

  if (portraitUrl && !portraitUrl.startsWith('https://')) back({ error: 'The portrait must be an https:// image link.' })
  if (photoUrl && !photoUrl.startsWith('https://')) back({ error: 'The photo must be an https:// image link.' })

  const supabase = await createClient()
  const { error } = await supabase
    .from('site_settings')
    .update({
      hero_lines: joinLines(hero) || null,
      newsletter_heading: joinLines(heading) || null,
      footer_about: about || null,
      portrait_url: portraitUrl || null,
      portrait_alt: portraitAlt || null,
      hero_photo_url: photoUrl || null,
      hero_photo_alt: photoAlt || null,
      subscribe_heading: subscribeHeading || null,
      subscribe_intro: subscribeIntro || null,
      subscribe_art_line: subscribeArtLine || null,
      subscribe_note: subscribeNote,
    })
    .eq('id', true)
  if (error) back({ error: error.message })
  revalidatePath('/', 'layout')
  back({ message: 'Site content saved. It’s live now.' })
}
