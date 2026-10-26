import type { Metadata } from 'next'
import Link from 'next/link'
import ArrangeArticles, { type ArrangeItem } from '@/components/ArrangeArticles'
import Cover from '@/components/Cover'
import { requireAdmin } from '@/lib/auth'
import { formatDate } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import { one, oneLine } from '@/lib/utils'
import { resetArticleOrder } from '../../actions'
import './arrange.css'

export const metadata: Metadata = { title: 'Arrange articles' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

type Row = {
  id: string
  title: string
  slug: string
  published_at: string
  featured: boolean
  accent: string | null
  cover_style: string | null
  cover_image_url: string | null
  cover_alt: string | null
  sort_order: number | null
}

export default async function ArrangeArticlesPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin()
  const sp = await searchParams
  const message = one(sp.message)
  const error = one(sp.error)
  const now = new Date().toISOString()

  // Published and scheduled articles, in the order the site uses: placed ones by position,
  // anything not placed yet at the top, newest first.
  const supabase = await createClient()
  const { data } = await supabase
    .from('articles')
    .select('id,title,slug,published_at,featured,accent,cover_style,cover_image_url,cover_alt,sort_order')
    .eq('status', 'published')
    .order('sort_order', { ascending: true, nullsFirst: true })
    .order('published_at', { ascending: false })
    .order('id', { ascending: true })
    .limit(1000)
  const rows = (data ?? []) as unknown as Row[]
  const arranged = rows.some((row) => row.sort_order !== null)
  const featured = rows.find((row) => row.featured && row.published_at <= now)

  const items: ArrangeItem[] = rows.map((row) => {
    const live = row.published_at <= now
    return {
      id: row.id,
      title: oneLine(row.title),
      meta: live ? formatDate(row.published_at, 'short') : `Goes live ${formatDate(row.published_at, 'short')}`,
      live,
      unplaced: arranged && row.sort_order === null,
      thumb: <Cover article={{ ...row, cover_alt: row.cover_alt ?? '' }} sizes="80px" />,
    }
  })

  return (
    <div className="arrange-page">
      <p className="back">
        <Link href="/admin/articles">All articles</Link>
      </p>
      <div className="admin-head">
        <h1>Arrange articles</h1>
        <a href="/articles" className="btn btn-secondary" target="_blank" rel="noopener noreferrer">
          View Articles page
        </a>
      </div>
      <p className="arrange-intro">
        Put the articles in the order readers should see them, then save. The home page, the Articles page, topic pages and the
        Previous and Next links under each article all follow it. Drag a row by its handle, or use its arrows. Anything you
        publish later goes to the top until you move it.
      </p>
      {message && (
        <p className="notice success" role="status" style={{ marginBottom: 16 }}>
          {message}
        </p>
      )}
      {error && (
        <p className="notice error" role="alert" style={{ marginBottom: 16 }}>
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <div className="empty">
          <p>Nothing is published yet. Articles show up here once they’re published or scheduled.</p>
        </div>
      ) : (
        <ArrangeArticles items={items} featuredId={featured?.id ?? null} />
      )}

      {arranged && (
        <details className="danger-zone arrange-reset">
          <summary>Go back to newest first</summary>
          <p className="hint">Clears the order you set. Every page lists articles by date again, newest first.</p>
          <form action={resetArticleOrder}>
            <button type="submit" className="btn btn-secondary">
              Clear the order
            </button>
          </form>
        </details>
      )}
    </div>
  )
}
