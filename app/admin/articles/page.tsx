import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { formatDate } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import { ACCESS_LABELS, type AccessLevel, type ArticleStatus } from '@/lib/types'
import { one } from '@/lib/utils'
import { setFeatured } from '../actions'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

type Row = {
  id: string
  title: string
  slug: string
  status: ArticleStatus
  published_at: string | null
  access: AccessLevel
  featured: boolean
  updated_at: string
}

const FILTERS = [
  ['all', 'All'],
  ['published', 'Published'],
  ['scheduled', 'Scheduled'],
  ['draft', 'Drafts'],
  ['archived', 'Archived'],
] as const

export default async function AdminArticles({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin()
  const sp = await searchParams
  const filter = one(sp.status) ?? 'all'
  const message = one(sp.message)
  const error = one(sp.error)
  const now = new Date().toISOString()

  const supabase = await createClient()
  let query = supabase
    .from('articles')
    .select('id,title,slug,status,published_at,access,featured,updated_at')
    .order('updated_at', { ascending: false })
    .limit(300)
  if (filter === 'published') query = query.eq('status', 'published').lte('published_at', now)
  else if (filter === 'scheduled') query = query.eq('status', 'published').gt('published_at', now)
  else if (filter === 'draft') query = query.eq('status', 'draft')
  else if (filter === 'archived') query = query.eq('status', 'archived')
  const { data } = await query
  const rows = (data ?? []) as unknown as Row[]

  const label = (row: Row) => {
    if (row.status === 'published' && row.published_at && row.published_at > now) return 'Scheduled'
    return row.status === 'published' ? 'Published' : row.status === 'archived' ? 'Archived' : 'Draft'
  }

  return (
    <>
      <div className="admin-head">
        <h1>Articles</h1>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Link href="/admin/articles/arrange" className="btn btn-secondary">
            Arrange order
          </Link>
          <Link href="/admin/articles/new" className="btn">
            New article
          </Link>
        </div>
      </div>
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

      <nav className="tabs" aria-label="Filter articles">
        {FILTERS.map(([value, text]) => (
          <Link key={value} href={value === 'all' ? '/admin/articles' : `/admin/articles?status=${value}`} aria-current={filter === value ? 'true' : undefined}>
            {text}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <div className="empty">
          <p>No articles here yet.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Access</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="title-cell">
                    <Link href={`/admin/articles/${row.id}`}>{row.title}</Link>
                    <span className="sub">/articles/{row.slug}</span>
                  </td>
                  <td>
                    <span className={`badge${label(row) === 'Published' ? ' solid' : ''}`}>{label(row)}</span>
                    {row.featured && (
                      <span className="badge" style={{ marginLeft: 6 }}>
                        Featured
                      </span>
                    )}
                  </td>
                  <td>{ACCESS_LABELS[row.access]}</td>
                  <td className="meta" style={{ fontSize: 13 }}>
                    {row.published_at ? formatDate(row.published_at, 'short') : '—'}
                  </td>
                  <td>
                    <div className="row-actions">
                      <Link href={`/admin/articles/${row.id}`}>Edit</Link>
                      <Link href={`/admin/articles/${row.id}/preview`}>Preview</Link>
                      {label(row) === 'Published' && <Link href={`/articles/${row.slug}`}>View</Link>}
                      {row.status === 'published' && (
                        <form action={setFeatured} className="inline-form">
                          <input type="hidden" name="id" value={row.id} />
                          <input type="hidden" name="featured" value={row.featured ? '' : '1'} />
                          <button type="submit" className="link-btn">
                            {row.featured ? 'Unfeature' : 'Feature'}
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
