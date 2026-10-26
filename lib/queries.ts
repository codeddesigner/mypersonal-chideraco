import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { site } from '@/lib/site'
import type { Article, ArticleSummary, Comment, Settings, Subscription, Topic, TopicWithCount } from '@/lib/types'
import { curlyApostrophes } from '@/lib/utils'

export const PAGE_SIZE = 24

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

const SUMMARY_COLUMNS =
  'id,title,slug,description,published_at,reading_minutes,access,featured,cover_image_url,cover_alt,accent,cover_style,text_colour,article_topics(topics(name,slug,sort_order))'

const nowIso = () => new Date().toISOString()

function topicsFrom(row: Row): Topic[] {
  if (Array.isArray(row.topics)) return row.topics as Topic[]
  const links = Array.isArray(row.article_topics) ? (row.article_topics as Row[]) : []
  return links
    .map((link) => link.topics as Row | null)
    .filter((t): t is Row => Boolean(t))
    .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))
    .map((t) => ({ name: String(t.name), slug: String(t.slug) }))
}

function toSummary(row: Row): ArticleSummary {
  return {
    id: String(row.id),
    title: curlyApostrophes(String(row.title)),
    slug: String(row.slug),
    description: row.description ?? '',
    published_at: row.published_at,
    reading_minutes: Number(row.reading_minutes) || 1,
    access: row.access,
    featured: Boolean(row.featured),
    topics: topicsFrom(row),
    cover_image_url: typeof row.cover_image_url === 'string' && row.cover_image_url ? row.cover_image_url : null,
    cover_alt: row.cover_alt ?? '',
    accent: row.accent ?? null,
    cover_style: typeof row.cover_style === 'string' && row.cover_style ? row.cover_style : null,
    text_colour: typeof row.text_colour === 'string' && row.text_colour ? row.text_colour : null,
  }
}

function toArticle(row: Row): Article {
  return {
    ...toSummary(row),
    preview: row.preview ?? '',
    author: row.author ?? site.author,
    status: row.status,
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : null,
  }
}

export type ArticleSort = 'arranged' | 'newest' | 'oldest'

export type ListOptions = {
  q?: string
  topic?: string
  // 'arranged' follows the order set in Admin → Articles → Arrange (newest first until something is moved).
  sort?: ArticleSort
  page?: number
  limit?: number
  exclude?: string | null
}

export async function listArticles(options: ListOptions = {}) {
  const supabase = await createClient()
  const limit = options.limit ?? PAGE_SIZE
  const page = Math.max(1, options.page ?? 1)
  const { data, error } = await supabase.rpc('list_articles_v4', {
    p_q: options.q?.trim() || null,
    p_topic: options.topic || null,
    p_sort: options.sort ?? 'arranged',
    p_limit: limit,
    p_offset: (page - 1) * limit,
    p_exclude: options.exclude ?? null,
  })
  if (error) throw new Error(`Could not load articles: ${error.message}`)
  const rows = (data ?? []) as unknown as Row[]
  const total = rows.length ? Number(rows[0].total_count) : 0
  return {
    articles: rows.map(toSummary),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / limit)),
    // Whether any live article has been placed by hand, so the Articles page can offer that order.
    arranged: rows.length ? Boolean(rows[0].arranged) : false,
  }
}

export const getFeatured = cache(async (): Promise<ArticleSummary | null> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('articles')
    .select(SUMMARY_COLUMNS)
    .eq('featured', true)
    .eq('status', 'published')
    .lte('published_at', nowIso())
    .limit(1)
    .maybeSingle()
  const row = data as unknown as Row | null
  return row ? toSummary(row) : null
})

export const getArticleBySlug = cache(async (slug: string): Promise<Article | null> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('articles')
    .select(`${SUMMARY_COLUMNS},preview,author,status,updated_at`)
    .eq('slug', slug)
    .eq('status', 'published')
    .lte('published_at', nowIso())
    .maybeSingle()
  const row = data as unknown as Row | null
  return row ? toArticle(row) : null
})

export async function getArticleById(id: string): Promise<Article | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('articles')
    .select(`${SUMMARY_COLUMNS},preview,author,status,updated_at`)
    .eq('id', id)
    .maybeSingle()
  const row = data as unknown as Row | null
  return row ? toArticle(row) : null
}

// Returns the full text only if the database grants this reader access.
export async function getArticleBody(articleId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('article_bodies').select('body').eq('article_id', articleId).maybeSingle()
  const row = data as unknown as { body: string } | null
  return row ? row.body : null
}

export type ArticleLink = { title: string; slug: string; accent: string | null; text_colour: string | null }

// The articles before and after this one in the order readers see them on the Articles page.
export async function getAdjacent(articleId: string) {
  const supabase = await createClient()
  const { data } = await supabase.rpc('adjacent_articles', { p_article: articleId })
  const rows = (data ?? []) as unknown as (ArticleLink & { direction: string })[]
  const link = (direction: string): ArticleLink | null => {
    const r = rows.find((row) => row.direction === direction)
    return r ? { title: curlyApostrophes(r.title), slug: r.slug, accent: r.accent, text_colour: r.text_colour } : null
  }
  return { previous: link('previous'), next: link('next') }
}

export async function getRelated(articleId: string, limit = 4): Promise<ArticleSummary[]> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('related_articles_v3', { p_article: articleId, p_limit: limit })
  return ((data ?? []) as unknown as Row[]).map(toSummary)
}

export const getTopics = cache(async (): Promise<TopicWithCount[]> => {
  const supabase = await createClient()
  const { data } = await supabase.rpc('topic_counts')
  return ((data ?? []) as unknown as Row[]).map((t) => ({
    id: String(t.id),
    name: String(t.name),
    slug: String(t.slug),
    sort_order: Number(t.sort_order) || 0,
    article_count: Number(t.article_count) || 0,
  }))
})

const DEFAULT_SETTINGS: Settings = {
  subscriptions_enabled: false,
  plan_name: 'Reader subscription',
  price_amount: 5,
  currency: 'USD',
  billing_interval: 'month',
  billing_provider: 'manual',
  checkout_url: null,
  subscribe_note: '',
  about_body: '',
  social_links: [],
}

export const getSettings = cache(async (): Promise<Settings> => {
  const supabase = await createClient()
  const { data } = await supabase.from('site_settings').select('*').eq('id', true).maybeSingle()
  const row = (data as unknown as Row | null) ?? {}
  return {
    ...DEFAULT_SETTINGS,
    ...row,
    price_amount: Number(row.price_amount ?? DEFAULT_SETTINGS.price_amount),
    social_links: Array.isArray(row.social_links) ? row.social_links : [],
  } as Settings
})

export async function getSubscription(userId: string): Promise<Subscription | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as unknown as Subscription | null) ?? null
}

// Comments under an article, oldest first. The database only returns them to people who can read the article.
export async function getComments(articleId: string): Promise<Comment[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('article_comments')
    .select('id,user_id,author_name,by_admin,body,created_at')
    .eq('article_id', articleId)
    .order('created_at', { ascending: true })
    .limit(300)
  return (data ?? []) as unknown as Comment[]
}

export function isActiveSubscription(sub: Pick<Subscription, 'status' | 'current_period_end'> | null | undefined) {
  if (!sub) return false
  if (sub.status !== 'active' && sub.status !== 'trialing') return false
  return !sub.current_period_end || new Date(sub.current_period_end) > new Date()
}
