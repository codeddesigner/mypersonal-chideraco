import type { MetadataRoute } from 'next'
import { GAMES } from '@/lib/games'
import { createPublicClient } from '@/lib/supabase/server'
import { site } from '@/lib/site'

export const revalidate = 3600

// Every page worth finding in a search: the main pages, each published article (with when it last changed),
// and each topic that has something in it. Empty topics are left out until they have an article.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createPublicClient()
  const [articles, topics] = await Promise.all([
    supabase
      .from('articles')
      .select('slug,updated_at')
      .eq('status', 'published')
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false })
      .limit(5000),
    supabase.rpc('topic_counts'),
  ])

  const articleRows = (articles.data ?? []) as unknown as { slug: string; updated_at: string }[]
  const topicRows = ((topics.data ?? []) as unknown as { slug: string; article_count: number | string }[]).filter(
    (t) => Number(t.article_count) > 0,
  )
  // The lists change whenever an article does.
  const latest = articleRows.reduce<string | undefined>((max, a) => (!max || a.updated_at > max ? a.updated_at : max), undefined)

  const entries: MetadataRoute.Sitemap = [
    { url: `${site.url}/`, lastModified: latest, changeFrequency: 'weekly', priority: 1 },
    { url: `${site.url}/articles`, lastModified: latest, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${site.url}/about`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${site.url}/topics`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${site.url}/subscribe`, changeFrequency: 'monthly', priority: 0.4 },
  ]
  for (const a of articleRows) entries.push({ url: `${site.url}/articles/${a.slug}`, lastModified: a.updated_at, changeFrequency: 'monthly', priority: 0.7 })
  for (const t of topicRows) entries.push({ url: `${site.url}/topics/${t.slug}`, changeFrequency: 'weekly', priority: 0.5 })
  for (const g of GAMES) entries.push({ url: `${site.url}${g.path}`, changeFrequency: 'yearly', priority: 0.2 })
  return entries
}
