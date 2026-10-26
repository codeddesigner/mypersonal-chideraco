import Link from 'next/link'
import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth'
import { formatDate } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import { buildHref, one, plural } from '@/lib/utils'
import { unsubscribeSubscriber } from '../newsletter-actions'

export const metadata: Metadata = { title: 'Subscribers' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>
type Row = { id: string; email: string; status: 'active' | 'unsubscribed'; source: string | null; created_at: string; unsubscribed_at: string | null }

const PAGE = 50
const SOURCES: Record<string, string> = { footer: 'Footer', subscribe: 'Subscribe page', popup: 'Pop-up' }
const FILTERS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Subscribed' },
  { value: 'unsubscribed', label: 'Unsubscribed' },
]

// Everyone who has signed up for the newsletter from the site.
export default async function AdminSubscribers({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin()
  const sp = await searchParams
  const q = (one(sp.q) ?? '').trim().slice(0, 100)
  const status = one(sp.status) === 'active' || one(sp.status) === 'unsubscribed' ? (one(sp.status) as string) : ''
  const page = Math.max(1, Number.parseInt(one(sp.page) ?? '1', 10) || 1)
  const message = one(sp.message)
  const error = one(sp.error)
  const href = (params: Record<string, string | number>) => buildHref('/admin/subscribers', { q, status, page, ...params })
  const returnTo = href({})

  const supabase = await createClient()
  let query = supabase
    .from('newsletter_subscribers')
    .select('id,email,status,source,created_at,unsubscribed_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1)
  if (q) query = query.ilike('email', `%${q.replace(/[%_\\]/g, '')}%`)
  if (status) query = query.eq('status', status)

  const [list, active, unsubscribed] = await Promise.all([
    query,
    supabase.from('newsletter_subscribers').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('newsletter_subscribers').select('id', { count: 'exact', head: true }).eq('status', 'unsubscribed'),
  ])
  const rows = (list.data ?? []) as unknown as Row[]
  const total = list.count ?? rows.length
  const activeCount = active.count ?? 0
  const unsubscribedCount = unsubscribed.count ?? 0

  return (
    <>
      <div className="admin-head">
        <h1>Subscribers</h1>
        {activeCount + unsubscribedCount > 0 && (
          <a href="/admin/subscribers/export" className="btn btn-secondary">
            Download CSV
          </a>
        )}
      </div>

      <div className="stats" style={{ marginBottom: 24 }}>
        <div className="stat">
          <div className="n">{activeCount}</div>
          <div className="l">Active subscribers</div>
        </div>
        <div className="stat">
          <div className="n">{unsubscribedCount}</div>
          <div className="l">Unsubscribed</div>
        </div>
        <div className="stat">
          <div className="n">{activeCount + unsubscribedCount}</div>
          <div className="l">Signed up in total</div>
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

      <div className="toolbar" style={{ borderTop: 0, paddingTop: 0 }}>
        <form method="get" action="/admin/subscribers" className="search-form" role="search">
          <label htmlFor="subscriber-q" className="sr-only">
            Search by email
          </label>
          <input id="subscriber-q" name="q" className="input" placeholder="Search by email" defaultValue={q} />
          {status && <input type="hidden" name="status" value={status} />}
          <button className="btn btn-secondary" type="submit">
            Search
          </button>
        </form>
        <div className="sort" role="group" aria-label="Show">
          {FILTERS.map((filter) => (
            <Link key={filter.value} href={buildHref('/admin/subscribers', { q, status: filter.value })} aria-current={status === filter.value ? 'true' : undefined}>
              {filter.label}
            </Link>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          <p>
            {q || status
              ? 'No subscribers match.'
              : 'No one has subscribed yet. Emails from the footer, the pop-up and the Subscribe page appear here.'}
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Status</th>
                <th>Subscribed</th>
                <th>Signed up from</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="title-cell">
                    <a href={`mailto:${row.email}`}>{row.email}</a>
                  </td>
                  <td>
                    {row.status === 'active' ? (
                      <span className="badge solid">Subscribed</span>
                    ) : (
                      <>
                        <span className="badge">Unsubscribed</span>
                        {row.unsubscribed_at && <span className="sub">{formatDate(row.unsubscribed_at, 'short')}</span>}
                      </>
                    )}
                  </td>
                  <td className="meta" style={{ fontSize: 13 }}>
                    {formatDate(row.created_at, 'short')}
                  </td>
                  <td style={{ fontSize: 13 }}>{(row.source && SOURCES[row.source]) || '—'}</td>
                  <td>
                    {row.status === 'active' && (
                      <form action={unsubscribeSubscriber} className="inline-form">
                        <input type="hidden" name="id" value={row.id} />
                        <input type="hidden" name="return_to" value={returnTo} />
                        <button type="submit" className="link-btn danger" style={{ fontSize: 13 }}>
                          Unsubscribe
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > PAGE && (
        <nav className="pagination" aria-label="Pagination">
          {page > 1 ? <a href={href({ page: page - 1 })}>← Previous</a> : <span />}
          <span className="meta">
            Page {page} of {Math.ceil(total / PAGE)}
          </span>
          {page * PAGE < total ? <a href={href({ page: page + 1 })}>Next →</a> : <span />}
        </nav>
      )}
      <p className="hint">
        {q || status ? `${plural(total, 'subscriber')} match. ` : ''}Newsletters go to active subscribers only. People unsubscribe with the
        link in each email; use Unsubscribe here if someone asks you directly.
      </p>
    </>
  )
}
