import { requireAdmin } from '@/lib/auth'
import { formatDate } from '@/lib/format'
import { isActiveSubscription } from '@/lib/queries'
import { createClient } from '@/lib/supabase/server'
import type { Subscription } from '@/lib/types'
import { buildHref, one, plural } from '@/lib/utils'
import { cancelSubscription, grantSubscription, setReaderStatus } from '../actions'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

type ReaderRow = {
  id: string
  email: string
  display_name: string | null
  role: 'reader' | 'admin'
  status: 'active' | 'suspended'
  created_at: string
  subscriptions: Pick<Subscription, 'status' | 'current_period_end'>[] | null
}

const PAGE = 50

export default async function AdminReaders({ searchParams }: { searchParams: SearchParams }) {
  const admin = await requireAdmin()
  const sp = await searchParams
  const q = (one(sp.q) ?? '').trim().slice(0, 100)
  const page = Math.max(1, Number.parseInt(one(sp.page) ?? '1', 10) || 1)
  const message = one(sp.message)
  const error = one(sp.error)
  const returnTo = buildHref('/admin/readers', { q, page })

  const supabase = await createClient()
  let query = supabase
    .from('profiles')
    .select('id,email,display_name,role,status,created_at,subscriptions(status,current_period_end,created_at)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1)
  if (q) query = query.ilike('email', `%${q.replace(/[%_]/g, '')}%`)
  const { data, count } = await query
  const rows = (data ?? []) as unknown as ReaderRow[]
  const total = count ?? rows.length

  return (
    <>
      <div className="admin-head">
        <h1>Readers</h1>
        <span className="meta">{plural(total, 'account')}</span>
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

      <form method="get" action="/admin/readers" className="search-form" style={{ marginBottom: 16 }} role="search">
        <label htmlFor="reader-q" className="sr-only">
          Search by email
        </label>
        <input id="reader-q" name="q" className="input" placeholder="Search by email" defaultValue={q} />
        <button className="btn btn-secondary" type="submit">
          Search
        </button>
      </form>

      {rows.length === 0 ? (
        <div className="empty">
          <p>{q ? 'No readers match that email.' : 'No one has signed up yet.'}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Reader</th>
                <th>Joined</th>
                <th>Account</th>
                <th>Subscription</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((reader) => {
                const subs = [...(reader.subscriptions ?? [])].sort((a, b) => ((b.current_period_end ?? '9') > (a.current_period_end ?? '9') ? 1 : -1))
                const activeSub = subs.find((s) => isActiveSubscription(s))
                return (
                  <tr key={reader.id}>
                    <td className="title-cell">
                      {reader.email}
                      {reader.display_name && <span className="sub">{reader.display_name}</span>}
                    </td>
                    <td className="meta" style={{ fontSize: 13 }}>
                      {formatDate(reader.created_at, 'short')}
                    </td>
                    <td>
                      <span className={`badge${reader.status === 'active' ? '' : ' solid'}`}>{reader.status === 'active' ? 'Active' : 'Suspended'}</span>
                      {reader.role === 'admin' && (
                        <span className="badge" style={{ marginLeft: 6 }}>
                          Admin
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {activeSub ? (
                        <>
                          <span className="badge solid">Subscribed</span>
                          <span className="sub">{activeSub.current_period_end ? `until ${formatDate(activeSub.current_period_end, 'short')}` : 'no end date'}</span>
                        </>
                      ) : subs.length > 0 ? (
                        <span className="muted">Lapsed</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        {activeSub ? (
                          <form action={cancelSubscription} className="inline-form">
                            <input type="hidden" name="user_id" value={reader.id} />
                            <input type="hidden" name="return_to" value={returnTo} />
                            <button type="submit" className="link-btn">
                              Cancel subscription
                            </button>
                          </form>
                        ) : (
                          <form action={grantSubscription} className="inline-form">
                            <input type="hidden" name="user_id" value={reader.id} />
                            <input type="hidden" name="return_to" value={returnTo} />
                            <button type="submit" className="link-btn">
                              Grant subscription
                            </button>
                          </form>
                        )}
                        {reader.id !== admin.id && (
                          <form action={setReaderStatus} className="inline-form">
                            <input type="hidden" name="id" value={reader.id} />
                            <input type="hidden" name="return_to" value={returnTo} />
                            <input type="hidden" name="status" value={reader.status === 'active' ? 'suspended' : 'active'} />
                            <button type="submit" className={`link-btn${reader.status === 'active' ? ' danger' : ''}`}>
                              {reader.status === 'active' ? 'Suspend' : 'Reactivate'}
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {total > PAGE && (
        <nav className="pagination" aria-label="Pagination">
          {page > 1 ? <a href={buildHref('/admin/readers', { q, page: page - 1 })}>← Previous</a> : <span />}
          <span className="meta">
            Page {page} of {Math.ceil(total / PAGE)}
          </span>
          {page * PAGE < total ? <a href={buildHref('/admin/readers', { q, page: page + 1 })}>Next →</a> : <span />}
        </nav>
      )}
      <p className="hint">
        Granting a subscription activates it for one billing period from today. Admin roles can only be changed in the database.
      </p>
    </>
  )
}
