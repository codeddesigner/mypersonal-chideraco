'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { isAccent, normaliseHex } from '@/lib/accent'
import { derivePreview } from '@/lib/article-text'
import { requireAdmin } from '@/lib/auth'
import { isCoverStyle } from '@/lib/cover'
import { emailCover, messageText, newsletterHtml, type NewsletterContent, type NewsletterCover } from '@/lib/newsletter-email'
import { mailSettings, sendBatch, sendOne, type OutgoingEmail, type SendFailure } from '@/lib/resend'
import { site } from '@/lib/site'
import { createClient } from '@/lib/supabase/server'
import type { AccessLevel, ArticleStatus } from '@/lib/types'
import { isUuid, slugify } from '@/lib/utils'

// Admin → Newsletter and Admin → Subscribers. Every action checks for the admin first, and the database
// checks again: the newsletter tables and functions refuse anyone who isn't the site admin.

export type Progress = { total: number; sent: number; failed: number; skipped: number; waiting: number; status: 'draft' | 'sending' | 'sent' }
export type Result = { error?: string; message?: string }
// One step of sending: the counts so far, whether it's finished, and how long to wait before the next step.
// trouble: Resend didn't answer properly; the page gives up (and offers Resume) if that keeps happening.
export type Step = { progress?: Progress; done?: boolean; waitMs?: number; note?: string; trouble?: boolean; error?: string }
// The article a newsletter came from, or was published as on the site.
export type LinkedArticle = { id: string; title: string; slug: string; access: AccessLevel; status: ArticleStatus; published_at: string | null }
const LINKED_ARTICLE = 'id,title,slug,access,status,published_at'
const COVER = 'cover_mode,cover_image_url,cover_alt,cover_style,accent,cover_seed'
const ACCESS: AccessLevel[] = ['public', 'members', 'subscribers']

// How many emails go in each request to Resend (it accepts up to 100).
const BATCH = 50
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const NOT_SET_UP = (missing: string[]) =>
  `Email sending isn’t set up yet. Add ${missing.join(' and ')} to the site’s environment variables in Vercel, then redeploy.`
const TEST_SENDER =
  'Emails are still going out from Resend’s test address, which only delivers to the email your Resend account uses. Verify chidera.co in Resend and switch the sender before sending to subscribers. Test emails to yourself work now.'

const oneLine = (value: unknown, max: number) =>
  (typeof value === 'string' ? value : '').replace(/\s+/g, ' ').trim().slice(0, max)

function frame(token?: string) {
  return { siteUrl: site.url, brand: site.brand, unsubscribeUrl: token ? `${site.url}/unsubscribe/${token}` : `${site.url}/unsubscribe` }
}

function buildEmail(content: NewsletterContent, to: string, token?: string): OutgoingEmail {
  const f = frame(token)
  const email: OutgoingEmail = { to, subject: content.subject.trim(), html: newsletterHtml(content, f), text: messageText(content, f) }
  if (token) {
    // One-click unsubscribe from the email program's own button (Gmail, Yahoo and Apple Mail show it).
    email.headers = {
      'List-Unsubscribe': `<${site.url}/api/newsletter/unsubscribe?token=${token}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    }
  }
  return email
}

function explain(failure: SendFailure): string {
  if (failure.kind === 'setup') return `Resend refused the email: ${failure.message} Check the API key, the sender address and that the domain is verified.`
  if (failure.kind === 'invalid') return `Resend refused the email: ${failure.message}`
  return failure.message
}

type Supabase = Awaited<ReturnType<typeof createClient>>

// The newsletter as it goes out, with its cover worked out as a picture for the email.
async function loadNewsletter(supabase: Supabase, id: string) {
  const { data } = await supabase.from('newsletter_campaigns').select(`subject,preheader,body,status,${COVER}`).eq('id', id).maybeSingle()
  const row = data as unknown as (NewsletterContent & NewsletterCover & { status: Progress['status'] }) | null
  if (!row) return null
  return { subject: row.subject, preheader: row.preheader, body: row.body, status: row.status, cover: emailCover(row, row.subject, site.url) }
}

// The cover settings from the composer, checked. The artwork's seed is set when the newsletter is made.
type CoverInput = Omit<NewsletterCover, 'cover_seed'>
function cleanCover(input: Partial<CoverInput> | undefined): CoverInput | { error: string } {
  const mode = input?.cover_mode === 'image' || input?.cover_mode === 'none' ? input.cover_mode : 'art'
  const url = typeof input?.cover_image_url === 'string' ? input.cover_image_url.trim() : ''
  if (url && (!/^https:[/][/]./.test(url) || /\s/.test(url) || url.length > 1000)) return { error: 'The cover image must be an https:// link.' }
  const accent = isAccent(input?.accent) ? input.accent : normaliseHex(input?.accent) || null
  return {
    cover_mode: mode,
    cover_image_url: url || null,
    cover_alt: oneLine(input?.cover_alt, 300),
    cover_style: isCoverStyle(input?.cover_style) ? input.cover_style : null,
    accent,
  }
}

/* Writing ----------------------------------------------------------------------------------------------- */

export async function createNewsletter() {
  const admin = await requireAdmin()
  const supabase = await createClient()
  // New newsletters start with the generated artwork as their cover, like a new article.
  const { data, error } = await supabase.from('newsletter_campaigns').insert({ created_by: admin.id, cover_mode: 'art' }).select('id').single()
  if (error || !data) redirect(`/admin/newsletter?${new URLSearchParams({ error: error?.message ?? 'Couldn’t start a new newsletter.' })}`)
  redirect(`/admin/newsletter/${(data as { id: string }).id}`)
}

export async function saveNewsletter(
  id: string,
  fields: NewsletterContent & { coverSettings?: Partial<CoverInput> }
): Promise<Result & { savedAt?: string }> {
  await requireAdmin()
  if (!isUuid(id)) return { error: 'Unknown newsletter.' }
  const subject = oneLine(fields.subject, 200)
  const preheader = oneLine(fields.preheader, 200)
  const body = typeof fields.body === 'string' ? fields.body.replace(/\r/g, '') : ''
  if (body.length > 100_000) return { error: 'The message is too long. Keep it under 100,000 characters.' }
  const cover = cleanCover(fields.coverSettings)
  if ('error' in cover) return { error: cover.error }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('newsletter_campaigns')
    .update({ subject, preheader, body, ...cover })
    .eq('id', id)
    .select('updated_at')
  if (error) return { error: error.message }
  // The database only lets drafts change, so no row back means it has already gone out.
  if (!data || data.length === 0) return { error: 'This newsletter has already been sent, so it can’t be changed.' }
  return { message: 'Saved.', savedAt: (data[0] as { updated_at: string }).updated_at }
}

export async function deleteNewsletter(id: string): Promise<Result> {
  await requireAdmin()
  if (!isUuid(id)) return { error: 'Unknown newsletter.' }
  const supabase = await createClient()
  const { data, error } = await supabase.from('newsletter_campaigns').delete().eq('id', id).select('id')
  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Only drafts can be deleted. This one has already been sent.' }
  redirect(`/admin/newsletter?${new URLSearchParams({ message: 'Draft deleted.' })}`)
}

/* Newsletters and articles ------------------------------------------------------------------------------ */

type ArticleForEmail = LinkedArticle & {
  description: string | null
  preview: string | null
  cover_image_url: string | null
  cover_alt: string | null
  cover_style: string | null
  accent: string | null
}

// The email made from an article. Articles everyone can read go out in full; for the others the email has the
// preview and a link, so an email can't be used to get round who may read the full article.
// The article's cover goes on top of the email as the newsletter's cover (see emailArticle).
function articleEmailBody(article: ArticleForEmail, body: string): string {
  const url = `${site.url}/articles/${article.slug}`
  const teaser = () => {
    const preview = (article.preview ?? '').trim() || derivePreview(body)
    return [...(preview ? [preview] : []), `**[Read the full article on the website](${url})**`].join('\n\n')
  }
  if (article.access !== 'public' || !body.trim()) return teaser()
  const full = [body.trim(), `[Read it on the website](${url})`].join('\n\n')
  return full.length <= 100_000 ? full : teaser()
}

// Admin → Articles → Email to subscribers: makes a newsletter draft from the article and opens it, ready to
// check, test and send. If there's already an unsent one for this article, that one opens instead.
export async function emailArticle(articleId: string): Promise<Result> {
  const admin = await requireAdmin()
  if (!isUuid(articleId)) return { error: 'Unknown article.' }
  const supabase = await createClient()

  const { data: drafts } = await supabase
    .from('newsletter_campaigns')
    .select('id')
    .eq('article_id', articleId)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(1)
  const draft = (drafts ?? [])[0] as { id: string } | undefined
  if (draft) redirect(`/admin/newsletter/${draft.id}`)

  const [articleRes, bodyRes] = await Promise.all([
    supabase
      .from('articles')
      .select(`${LINKED_ARTICLE},description,preview,cover_image_url,cover_alt,cover_style,accent`)
      .eq('id', articleId)
      .maybeSingle(),
    supabase.from('article_bodies').select('body').eq('article_id', articleId).maybeSingle(),
  ])
  const article = articleRes.data as unknown as ArticleForEmail | null
  if (!article) return { error: 'This article no longer exists.' }
  const body = (bodyRes.data as unknown as { body: string } | null)?.body ?? ''

  const { data, error } = await supabase
    .from('newsletter_campaigns')
    .insert({
      created_by: admin.id,
      article_id: articleId,
      subject: oneLine(article.title, 200),
      preheader: oneLine(article.description, 200),
      body: articleEmailBody(article, body),
      // The article's own cover: its uploaded image, or its artwork drawn from its address, design and colour.
      cover_mode: article.cover_image_url ? 'image' : 'art',
      cover_image_url: article.cover_image_url,
      cover_alt: (article.cover_alt ?? '').slice(0, 300),
      cover_style: article.cover_style,
      accent: article.accent,
      cover_seed: article.slug,
    })
    .select('id')
    .single()
  if (error || !data) return { error: error?.message ?? 'Couldn’t make the newsletter.' }
  redirect(`/admin/newsletter/${(data as { id: string }).id}?from=article`)
}

// The article's address, made from the title; -2, -3 and so on are added if it's already used.
async function freeSlug(supabase: Supabase, title: string): Promise<string> {
  const base = slugify(title).slice(0, 72) || 'newsletter'
  const { data } = await supabase.from('articles').select('slug').like('slug', `${base}%`).limit(1000)
  const taken = new Set(((data ?? []) as unknown as { slug: string }[]).map((row) => row.slug))
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

// Admin → Newsletter → Where it goes: publishes the newsletter on the site as an article.
// 'both' keeps the newsletter (it's emailed too, or already was) and links the two.
// 'site' is website only: the draft becomes the article and the article editor opens.
export async function publishNewsletterOnSite(id: string, accessInput: string, mode: 'both' | 'site'): Promise<Result & { article?: LinkedArticle }> {
  await requireAdmin()
  if (!isUuid(id)) return { error: 'Unknown newsletter.' }
  const access = ACCESS.find((level) => level === accessInput) ?? 'public'
  const supabase = await createClient()

  const { data } = await supabase.from('newsletter_campaigns').select(`subject,preheader,body,status,article_id,${COVER}`).eq('id', id).maybeSingle()
  const newsletter = data as unknown as (NewsletterContent & NewsletterCover & { status: Progress['status']; article_id: string | null }) | null
  if (!newsletter) return { error: 'Unknown newsletter.' }

  if (newsletter.article_id) {
    const { data: existing } = await supabase.from('articles').select(LINKED_ARTICLE).eq('id', newsletter.article_id).maybeSingle()
    if (existing) return { article: existing as unknown as LinkedArticle, message: 'It’s already on the website.' }
  }

  const title = oneLine(newsletter.subject, 300)
  const body = newsletter.body.trim()
  if (!title || !body) return { error: 'Add a subject and a message first.' }

  // Made as a draft first and published once its text is in, so the site never shows an empty article.
  const { data: created, error } = await supabase
    .from('articles')
    .insert({
      title,
      slug: await freeSlug(supabase, title),
      description: oneLine(newsletter.preheader, 600),
      preview: derivePreview(body),
      access,
      featured: false,
      status: 'draft',
      // The newsletter's cover becomes the article's. Without one, the article gets the automatic artwork.
      cover_image_url: newsletter.cover_mode === 'image' ? newsletter.cover_image_url : null,
      cover_alt: newsletter.cover_mode === 'image' && newsletter.cover_image_url ? newsletter.cover_alt : '',
      cover_style: newsletter.cover_mode === 'none' ? null : newsletter.cover_style,
      accent: newsletter.cover_mode === 'none' ? null : newsletter.accent,
    })
    .select('id')
    .single()
  if (error || !created) return { error: error?.code === '23505' ? 'Another article already uses this title’s address. Change the subject a little and try again.' : (error?.message ?? 'Couldn’t make the article.') }
  const articleId = (created as { id: string }).id

  const { error: bodyError } = await supabase.from('article_bodies').upsert({ article_id: articleId, body }, { onConflict: 'article_id' })
  const { data: published, error: publishError } = bodyError
    ? { data: null, error: bodyError }
    : await supabase.from('articles').update({ status: 'published', published_at: new Date().toISOString() }).eq('id', articleId).select(LINKED_ARTICLE).single()
  if (publishError || !published) {
    await supabase.from('articles').delete().eq('id', articleId)
    return { error: publishError?.message ?? 'Couldn’t publish the article.' }
  }
  revalidatePath('/', 'layout')

  if (mode === 'site' && newsletter.status === 'draft') {
    await supabase.from('newsletter_campaigns').delete().eq('id', id)
    redirect(`/admin/articles/${articleId}?from=newsletter`)
  }

  const { error: linkError } = await supabase.rpc('newsletter_link_article', { p_campaign: id, p_article: articleId })
  if (linkError) return { article: published as unknown as LinkedArticle, error: `It’s on the website, but couldn’t be linked to this newsletter: ${linkError.message}` }
  return { article: published as unknown as LinkedArticle, message: 'Published on the website.' }
}

/* Test email -------------------------------------------------------------------------------------------- */

export async function sendTestNewsletter(id: string, to: string): Promise<Result> {
  await requireAdmin()
  const mail = mailSettings()
  if (!mail.ready) return { error: NOT_SET_UP(mail.missing) }
  const address = oneLine(to, 254).toLowerCase()
  if (!EMAIL.test(address)) return { error: 'Enter the email address the test should go to.' }
  if (!isUuid(id)) return { error: 'Unknown newsletter.' }

  const supabase = await createClient()
  const content = await loadNewsletter(supabase, id)
  if (!content) return { error: 'Unknown newsletter.' }
  if (!content.subject.trim() || !content.body.trim()) return { error: 'Add a subject and a message first.' }

  // A test has no real unsubscribe link and is never counted as sent.
  const email = buildEmail(content, address)
  const result = await sendOne({ ...email, subject: `[Test] ${email.subject}` })
  if (!result.ok) return { error: explain(result) }

  await supabase.from('newsletter_campaigns').update({ test_sent_to: address, test_sent_at: new Date().toISOString() }).eq('id', id)
  return { message: `Test sent to ${address}. It can take a minute to arrive; check spam if it doesn’t.` }
}

/* Sending ----------------------------------------------------------------------------------------------- */

// Queues everyone who is subscribed right now. The database refuses to start a newsletter twice.
export async function startNewsletter(id: string): Promise<Result & { total?: number }> {
  await requireAdmin()
  const mail = mailSettings()
  if (!mail.ready) return { error: NOT_SET_UP(mail.missing) }
  if (mail.testSender) return { error: TEST_SENDER }
  if (!isUuid(id)) return { error: 'Unknown newsletter.' }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('newsletter_start', { p_campaign: id })
  if (error) return { error: error.message }
  return { total: Number(data) || 0 }
}

// Sends the next batch from the queue. The admin page calls this again and again until everything is sent,
// so no single request has to send the whole list. If the page is closed part-way, Resume picks up from here.
export async function sendNextBatch(id: string): Promise<Step> {
  await requireAdmin()
  const mail = mailSettings()
  if (!mail.ready) return { error: NOT_SET_UP(mail.missing) }
  if (mail.testSender) return { error: TEST_SENDER }
  if (!isUuid(id)) return { error: 'Unknown newsletter.' }
  const supabase = await createClient()

  const progress = async (): Promise<Progress> => {
    const { data } = await supabase.rpc('newsletter_progress', { p_campaign: id })
    return data as unknown as Progress
  }
  const settle = async (batch: string, outcome: 'sent' | 'failed' | 'retry' | 'split', ids?: string[], error?: string): Promise<Progress> => {
    const { data, error: dbError } = await supabase.rpc('newsletter_settle', {
      p_campaign: id,
      p_batch: batch,
      p_outcome: outcome,
      p_provider_ids: ids ?? null,
      p_error: error ?? null,
    })
    if (dbError) throw new Error(dbError.message)
    return data as unknown as Progress
  }

  const { data: claimed, error: claimError } = await supabase.rpc('newsletter_claim', { p_campaign: id, p_limit: BATCH })
  if (claimError) return { error: claimError.message }
  const rows = (claimed ?? []) as unknown as { delivery_id: number; to_email: string; token: string; batch: string }[]

  if (rows.length === 0) {
    const now = await progress()
    if (now.waiting === 0 || now.status !== 'sending') return { progress: now, done: true }
    // Everything left was handed out in the last two minutes by a request that never reported back.
    // It comes back automatically after that, with the same key, so waiting is all that's needed.
    return { progress: now, waitMs: 10_000, note: 'Waiting to confirm the last batch…' }
  }

  const content = await loadNewsletter(supabase, id)
  if (!content || content.status !== 'sending') return { error: 'This newsletter isn’t being sent.' }

  const batch = rows[0].batch
  const emails = rows.map((row) => buildEmail(content, row.to_email, row.token))
  const result = await sendBatch(emails, `newsletter-${batch}`)

  try {
    if (result.ok) {
      const now = await settle(batch, 'sent', result.ids)
      return { progress: now, done: now.waiting === 0 }
    }
    switch (result.kind) {
      case 'invalid':
        // One bad address makes Resend refuse a whole batch. Send these one at a time to find it.
        if (rows.length > 1) return { progress: await settle(batch, 'split') }
        return { progress: await settle(batch, 'failed', undefined, result.message) }
      case 'conflict':
        return {
          progress: await settle(batch, 'failed', undefined, 'Resend had already accepted a different message under this batch’s key, so it wasn’t sent again.'),
        }
      case 'rate_limited':
      case 'busy':
        return { progress: await settle(batch, 'retry', undefined, result.message), waitMs: result.retryAfterMs ?? 1500 }
      case 'unavailable':
        return {
          progress: await settle(batch, 'retry', undefined, result.message),
          waitMs: result.retryAfterMs ?? 3000,
          note: 'Resend didn’t answer. Trying the same batch again…',
          trouble: true,
        }
      default:
        // quota or setup: nothing was sent. Stop until it's fixed; Resume sends this batch again.
        return { progress: await settle(batch, 'retry', undefined, result.message), error: explain(result) }
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Couldn’t record the batch.' }
  }
}

// Puts addresses Resend turned down back in the queue. They were never sent, so this can't double up.
export async function retryFailedNewsletter(id: string): Promise<Result & { count?: number }> {
  await requireAdmin()
  if (!isUuid(id)) return { error: 'Unknown newsletter.' }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('newsletter_retry_failed', { p_campaign: id })
  if (error) return { error: error.message }
  return { count: Number(data) || 0 }
}

/* Subscribers ------------------------------------------------------------------------------------------- */

// Unsubscribes someone on their behalf (for example when they ask by email).
export async function unsubscribeSubscriber(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const raw = String(formData.get('return_to') ?? '')
  const returnTo = raw.startsWith('/admin/subscribers') ? raw : '/admin/subscribers'
  const join = returnTo.includes('?') ? '&' : '?'
  if (!isUuid(id)) redirect(`${returnTo}${join}${new URLSearchParams({ error: 'Unknown subscriber.' })}`)

  const supabase = await createClient()
  const { error } = await supabase
    .from('newsletter_subscribers')
    .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'active')
  if (error) redirect(`${returnTo}${join}${new URLSearchParams({ error: error.message })}`)
  redirect(`${returnTo}${join}${new URLSearchParams({ message: 'Unsubscribed. They won’t get future newsletters.' })}`)
}
