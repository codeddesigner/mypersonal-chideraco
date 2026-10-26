'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { isAccent, normaliseHex } from '@/lib/accent'
import { isCoverStyle } from '@/lib/cover'
import { requireAdmin } from '@/lib/auth'
import { track } from '@/lib/analytics'
import { derivePreview } from '@/lib/article-text'
import { formatDateTime, fromLocalInput } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import { isUuid, slugify } from '@/lib/utils'

export type ActionResult = { error?: string; message?: string }

const str = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value : '')

// Line breaks and whitespace, spelled out by character code so this file needs no escapes.
const NEWLINE = String.fromCharCode(10)
const SPACES = String.fromCharCode(32, 9, 10, 11, 12, 13)
const HAS_SPACE = new RegExp('[' + SPACES + ']')
const ACCESS = ['public', 'members', 'subscribers']

function describe(error: { code?: string; message: string }): string {
  if (error.code === '23505') return 'Another article already uses this URL. Choose a different one.'
  if (error.code === '42501') return 'You don’t have permission to do that.'
  return error.message
}

function back(path: string, params: Record<string, string>): never {
  redirect(`${path}?${new URLSearchParams(params)}`)
}

/* Articles ---------------------------------------------------------------- */

export async function saveArticle(formData: FormData): Promise<ActionResult> {
  await requireAdmin()
  const supabase = await createClient()

  const id = str(formData.get('id')) || null
  const intent = str(formData.get('intent'))
  // The title may break over up to four lines on the article page.
  const title = str(formData.get('title'))
    .split(NEWLINE)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join(NEWLINE)
  const slug = slugify(str(formData.get('slug')) || title)
  const description = str(formData.get('description')).trim()
  const body = str(formData.get('body'))
  const preview = str(formData.get('preview')).trim() || derivePreview(body)
  const accessInput = str(formData.get('access'))
  const access = ACCESS.includes(accessInput) ? accessInput : 'members'
  const featured = str(formData.get('featured')) === '1'
  const topicIds = formData.getAll('topics').map(String).filter(isUuid)
  const publishedInput = str(formData.get('published_at'))
  const coverUrl = str(formData.get('cover_image_url')).trim()
  const coverAlt = str(formData.get('cover_alt')).trim().slice(0, 300)
  const accentInput = str(formData.get('accent'))
  const accent = isAccent(accentInput) ? accentInput : normaliseHex(accentInput) || null
  const styleInput = str(formData.get('cover_style'))
  const coverStyle = isCoverStyle(styleInput) ? styleInput : null
  const textColour = normaliseHex(str(formData.get('text_colour'))) || null
  // A read time typed in the editor; empty means worked out from the length (see migration 0016).
  const readInput = str(formData.get('reading_minutes_set')).trim()
  const readMinutes = Number.parseInt(readInput, 10)
  const readingSet = readInput && readMinutes >= 1 && readMinutes <= 600 ? readMinutes : null

  if (!title) return { error: 'Add a title.' }
  if (!slug) return { error: 'Add a URL for the article.' }
  if (readInput && readingSet === null) return { error: 'The read time must be a whole number of minutes, from 1 to 600.' }
  if (id && !isUuid(id)) return { error: 'Unknown article.' }
  if (coverUrl && (!/^https:[/][/]./.test(coverUrl) || HAS_SPACE.test(coverUrl))) return { error: 'The cover image must be an https:// link.' }

  let current: { status: string; published_at: string | null } | null = null
  if (id) {
    const { data } = await supabase.from('articles').select('status,published_at').eq('id', id).maybeSingle()
    current = data as unknown as { status: string; published_at: string | null } | null
    if (!current) return { error: 'This article no longer exists.' }
  }

  let status = current?.status ?? 'draft'
  if (intent === 'publish') status = 'published'
  else if (intent === 'draft') status = 'draft'
  else if (intent === 'archive') status = 'archived'

  let publishedAt: string | null = null
  if (publishedInput) {
    publishedAt = fromLocalInput(publishedInput)
    if (!publishedAt) return { error: 'The publication date isn’t valid.' }
  } else if (status === 'published') {
    // An empty date means "now". Keep an existing date only if it has already passed,
    // so clearing the date on a scheduled article publishes it immediately.
    const existing = current?.published_at
    publishedAt = existing && new Date(existing) <= new Date() ? existing : new Date().toISOString()
  }

  const row = {
    title,
    slug,
    description,
    preview,
    access,
    featured,
    status,
    published_at: publishedAt,
    cover_image_url: coverUrl || null,
    cover_alt: coverUrl ? coverAlt : '',
    accent,
    cover_style: coverStyle,
    text_colour: textColour,
    reading_minutes_set: readingSet,
  }

  let articleId = id
  if (id) {
    const { error } = await supabase.from('articles').update(row).eq('id', id)
    if (error) return { error: describe(error) }
  } else {
    const { data, error } = await supabase.from('articles').insert(row).select('id').single()
    if (error) return { error: describe(error) }
    articleId = (data as unknown as { id: string }).id
  }

  const { error: bodyError } = await supabase.from('article_bodies').upsert({ article_id: articleId, body }, { onConflict: 'article_id' })
  if (bodyError) return { error: describe(bodyError) }

  const { error: clearError } = await supabase.from('article_topics').delete().eq('article_id', articleId)
  if (clearError) return { error: describe(clearError) }
  if (topicIds.length > 0) {
    const { error: topicError } = await supabase
      .from('article_topics')
      .insert(topicIds.map((topic_id) => ({ article_id: articleId, topic_id })))
    if (topicError) return { error: describe(topicError) }
  }

  revalidatePath('/', 'layout')

  if (intent === 'preview') redirect(`/admin/articles/${articleId}/preview`)
  if (!id) redirect(`/admin/articles/${articleId}?created=1`)

  if (status === 'published') {
    if (publishedAt && new Date(publishedAt) > new Date()) return { message: `Scheduled for ${formatDateTime(publishedAt)} (Lagos time).` }
    return { message: intent === 'publish' ? 'Published.' : 'Changes saved.' }
  }
  if (status === 'archived') return { message: 'Archived. It no longer appears on the site.' }
  return { message: intent === 'draft' && current?.status === 'published' ? 'Unpublished. It’s a draft again.' : 'Draft saved.' }
}

export async function deleteArticle(id: string): Promise<ActionResult> {
  await requireAdmin()
  if (!isUuid(id)) return { error: 'Unknown article.' }
  const supabase = await createClient()
  const { error } = await supabase.from('articles').delete().eq('id', id)
  if (error) return { error: describe(error) }
  revalidatePath('/', 'layout')
  redirect('/admin/articles?message=Article+deleted.')
}

export async function setFeatured(formData: FormData) {
  await requireAdmin()
  const id = str(formData.get('id'))
  const featured = str(formData.get('featured')) === '1'
  if (!isUuid(id)) back('/admin/articles', { error: 'Unknown article.' })
  const supabase = await createClient()
  const { error } = await supabase.from('articles').update({ featured }).eq('id', id)
  if (error) back('/admin/articles', { error: describe(error) })
  revalidatePath('/', 'layout')
  back('/admin/articles', { message: featured ? 'Featured on the homepage.' : 'No longer featured.' })
}

/* Order on the site ------------------------------------------------------- */

const ARRANGE = '/admin/articles/arrange'

// Saves the order from Admin → Articles → Arrange: article ids, top to bottom, separated by commas.
export async function saveArticleOrder(formData: FormData) {
  await requireAdmin()
  const ids = Array.from(new Set(str(formData.get('order')).split(',').map((id) => id.trim()).filter(isUuid))).slice(0, 1000)
  if (ids.length === 0) back(ARRANGE, { error: 'There’s nothing to save yet.' })
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_article_order', { p_ids: ids })
  if (error) back(ARRANGE, { error: describe(error) })
  revalidatePath('/', 'layout')
  back(ARRANGE, { message: 'Order saved. It’s live on the site now.' })
}

// Clears the order, so the site lists articles newest first again.
export async function resetArticleOrder() {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_article_order', { p_ids: [] })
  if (error) back(ARRANGE, { error: describe(error) })
  revalidatePath('/', 'layout')
  back(ARRANGE, { message: 'Back to newest first.' })
}

/* Topics ------------------------------------------------------------------ */

export async function createTopic(formData: FormData) {
  await requireAdmin()
  const name = str(formData.get('name')).trim()
  const slug = slugify(str(formData.get('slug')) || name)
  if (!name || !slug) back('/admin/topics', { error: 'Give the topic a name.' })

  const supabase = await createClient()
  const { data: last } = await supabase.from('topics').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle()
  const sortOrder = (Number((last as unknown as { sort_order: number } | null)?.sort_order) || 0) + 1
  const { error } = await supabase.from('topics').insert({ name, slug, sort_order: sortOrder })
  if (error) back('/admin/topics', { error: error.code === '23505' ? 'A topic with that name or URL already exists.' : error.message })
  revalidatePath('/', 'layout')
  back('/admin/topics', { message: `Added “${name}”.` })
}

export async function updateTopic(formData: FormData) {
  await requireAdmin()
  const id = str(formData.get('id'))
  const name = str(formData.get('name')).trim()
  const slug = slugify(str(formData.get('slug')) || name)
  const sortOrder = Number.parseInt(str(formData.get('sort_order')), 10)
  if (!isUuid(id) || !name || !slug) back('/admin/topics', { error: 'A topic needs a name and URL.' })

  const supabase = await createClient()
  const { error } = await supabase
    .from('topics')
    .update({ name, slug, sort_order: Number.isFinite(sortOrder) ? sortOrder : 0 })
    .eq('id', id)
  if (error) back('/admin/topics', { error: error.code === '23505' ? 'Another topic already uses that name or URL.' : error.message })
  revalidatePath('/', 'layout')
  back('/admin/topics', { message: `Saved “${name}”.` })
}

export async function deleteTopic(formData: FormData) {
  await requireAdmin()
  const id = str(formData.get('id'))
  if (!isUuid(id)) back('/admin/topics', { error: 'Unknown topic.' })
  const supabase = await createClient()
  const { error } = await supabase.from('topics').delete().eq('id', id)
  if (error) back('/admin/topics', { error: error.message })
  revalidatePath('/', 'layout')
  back('/admin/topics', { message: 'Topic removed. Its articles are untouched.' })
}

/* Readers ----------------------------------------------------------------- */

export async function setReaderStatus(formData: FormData) {
  const admin = await requireAdmin()
  const id = str(formData.get('id'))
  const status = str(formData.get('status')) === 'suspended' ? 'suspended' : 'active'
  const returnTo = str(formData.get('return_to')) || '/admin/readers'
  if (!isUuid(id)) back(returnTo, { error: 'Unknown reader.' })
  if (id === admin.id) back(returnTo, { error: 'You can’t suspend your own account.' })

  const supabase = await createClient()
  const { error } = await supabase.from('profiles').update({ status }).eq('id', id)
  if (error) back(returnTo, { error: error.message })
  back(returnTo, { message: status === 'suspended' ? 'Account suspended.' : 'Account reactivated.' })
}

export async function grantSubscription(formData: FormData) {
  await requireAdmin()
  const userId = str(formData.get('user_id'))
  const returnTo = str(formData.get('return_to')) || '/admin/readers'
  if (!isUuid(userId)) back(returnTo, { error: 'Unknown reader.' })

  const supabase = await createClient()
  const { data } = await supabase.from('site_settings').select('plan_name,billing_interval,billing_provider').eq('id', true).maybeSingle()
  const settings = data as unknown as { plan_name: string; billing_interval: string; billing_provider: string } | null

  const end = new Date()
  if (settings?.billing_interval === 'year') end.setFullYear(end.getFullYear() + 1)
  else end.setMonth(end.getMonth() + 1)

  const { error } = await supabase.from('subscriptions').insert({
    user_id: userId,
    status: 'active',
    plan: settings?.plan_name ?? 'standard',
    provider: settings?.billing_provider ?? 'manual',
    current_period_end: end.toISOString(),
  })
  if (error) back(returnTo, { error: error.message })
  await track(supabase, { name: 'subscription_completed', user_id: userId, path: '/admin/readers' })
  back(returnTo, { message: `Subscription active until ${formatDateTime(end.toISOString())}.` })
}

export async function cancelSubscription(formData: FormData) {
  await requireAdmin()
  const userId = str(formData.get('user_id'))
  const returnTo = str(formData.get('return_to')) || '/admin/readers'
  if (!isUuid(userId)) back(returnTo, { error: 'Unknown reader.' })

  const supabase = await createClient()
  const { error } = await supabase
    .from('subscriptions')
    .update({ status: 'canceled', current_period_end: new Date().toISOString() })
    .eq('user_id', userId)
    .in('status', ['active', 'trialing', 'past_due'])
  if (error) back(returnTo, { error: error.message })
  back(returnTo, { message: 'Subscription cancelled.' })
}

/* Settings ---------------------------------------------------------------- */

function parseLinks(input: string) {
  return input
    .split(NEWLINE)
    .map((line) => line.split('|').map((part) => part.trim()))
    .filter(([label, url]) => label && url && /^(https:[/][/]|mailto:)/i.test(url))
    .slice(0, 12)
    .map(([label, url]) => ({ label: label.slice(0, 40), url: url.slice(0, 300) }))
}

export async function updateSettings(formData: FormData) {
  await requireAdmin()
  const price = Number.parseFloat(str(formData.get('price_amount')))
  const currency = str(formData.get('currency')).trim().toUpperCase()
  const checkoutUrl = str(formData.get('checkout_url')).trim()
  const interval = str(formData.get('billing_interval')) === 'year' ? 'year' : 'month'
  const providers = ['manual', 'paystack', 'stripe', 'flutterwave', 'other']
  const providerInput = str(formData.get('billing_provider'))

  if (!/^[A-Z]{3}$/.test(currency)) back('/admin/settings', { error: 'Use a three-letter currency code, like USD or NGN.' })
  if (!Number.isFinite(price) || price < 0) back('/admin/settings', { error: 'Enter a valid price.' })
  if (checkoutUrl && !checkoutUrl.startsWith('https://')) back('/admin/settings', { error: 'The checkout link must start with https://' })

  const supabase = await createClient()
  const { error } = await supabase
    .from('site_settings')
    .update({
      subscriptions_enabled: str(formData.get('subscriptions_enabled')) === 'on',
      plan_name: str(formData.get('plan_name')).trim() || 'Reader subscription',
      price_amount: Math.round(price * 100) / 100,
      currency,
      billing_interval: interval,
      billing_provider: providers.includes(providerInput) ? providerInput : 'manual',
      checkout_url: checkoutUrl || null,
      // The Subscribe page's note moved to Admin → Site content; only overwrite it when a form sends it.
      ...(formData.has('subscribe_note') ? { subscribe_note: str(formData.get('subscribe_note')).trim() } : {}),
      // The About text moved to Admin → About page; only overwrite it when a form sends it.
      ...(formData.has('about_body') ? { about_body: str(formData.get('about_body')).trim() } : {}),
      social_links: parseLinks(str(formData.get('social_links'))),
    })
    .eq('id', true)
  if (error) back('/admin/settings', { error: error.message })
  revalidatePath('/', 'layout')
  back('/admin/settings', { message: 'Settings saved.' })
}
