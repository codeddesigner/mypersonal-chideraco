import { createPublicClient } from '@/lib/supabase/server'
import { site } from '@/lib/site'
import { curlyApostrophes, oneLine } from '@/lib/utils'

// The RSS feed: the latest articles, for feed readers and the sites that follow them.
// Each entry has the title, the short description and a link; the article itself stays on the site.

export const revalidate = 3600

type Row = {
  title: string
  slug: string
  description: string | null
  published_at: string
  author: string | null
  article_topics: { topics: { name: string } | null }[] | null
}

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export async function GET() {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('articles')
    .select('title,slug,description,published_at,author,article_topics(topics(name))')
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
    .limit(50)
  const rows = (data ?? []) as unknown as Row[]

  const items = rows
    .map((row) => {
      const link = `${site.url}/articles/${row.slug}`
      const topics = (row.article_topics ?? []).map((t) => t.topics?.name).filter((name): name is string => Boolean(name))
      return [
        '    <item>',
        `      <title>${escape(curlyApostrophes(oneLine(row.title)))}</title>`,
        `      <link>${escape(link)}</link>`,
        `      <guid isPermaLink="true">${escape(link)}</guid>`,
        `      <pubDate>${new Date(row.published_at).toUTCString()}</pubDate>`,
        `      <dc:creator>${escape(row.author || site.author)}</dc:creator>`,
        ...topics.map((name) => `      <category>${escape(name)}</category>`),
        row.description ? `      <description>${escape(row.description)}</description>` : '',
        '    </item>',
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n')

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    '  <channel>',
    `    <title>${escape(site.brand)}</title>`,
    `    <link>${escape(site.url)}</link>`,
    `    <description>${escape(site.description)}</description>`,
    '    <language>en</language>',
    `    <atom:link href="${escape(`${site.url}/feed.xml`)}" rel="self" type="application/rss+xml" />`,
    rows[0] ? `    <lastBuildDate>${new Date(rows[0].published_at).toUTCString()}</lastBuildDate>` : '',
    items,
    '  </channel>',
    '</rss>',
  ]
    .filter(Boolean)
    .join('\n')

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400' },
  })
}
