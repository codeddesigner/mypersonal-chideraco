import Link from 'next/link'
import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth'
import { formatDateTime } from '@/lib/format'
import { mailSettings } from '@/lib/resend'
import { createClient } from '@/lib/supabase/server'
import { one, plural } from '@/lib/utils'
import { createNewsletter } from '../newsletter-actions'
import SetupNotice from './SetupNotice'

export const metadata: Metadata = { title: 'Newsletter' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>
type Row = {
  id: string
  subject: string
  status: 'draft' | 'sending' | 'sent'
  total: number
  sent_count: number
  failed_count: number
  updated_at: string
  finished_at: string | null
  article_id: string | null
}

const STATUS = { draft: 'Draft', sending: 'Sending', sent: 'Sent' }

// Newsletters written here and sent to everyone on the subscriber list.
export default async function AdminNewsletter({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin()
  const sp = await searchParams
  const message = one(sp.message)
  const error = one(sp.error)
  const mail = mailSettings()

  const supabase = await createClient()
  const [list, active] = await Promise.all([
    supabase
      .from('newsletter_campaigns')
      .select('id,subject,status,total,sent_count,failed_count,updated_at,finished_at,article_id')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('newsletter_subscribers').select('id', { count: 'exact', head: true }).eq('status', 'active'),
  ])
  const rows = (list.data ?? []) as unknown as Row[]
  const activeCount = active.count ?? 0

  return (
    <>
      <div className="admin-head">
        <h1>Newsletter</h1>
        <form action={createNewsletter}>
          <button type="submit" className="btn">
            New newsletter
          </button>
        </form>
      </div>

      {(!mail.ready || mail.testSender) && <SetupNotice missing={mail.missing} testSender={mail.testSender} />}
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

      <p className="muted" style={{ margin: '0 0 20px' }}>
        The next newsletter goes to {plural(activeCount, 'active subscriber')}. <Link href="/admin/subscribers">See the list</Link>.
      </p>

      {rows.length === 0 ? (
        <div className="empty">
          <p>No newsletters yet. Press New newsletter to write the first one.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Status</th>
                <th className="num">Sent</th>
                <th className="num">Failed</th>
                <th>Last change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="title-cell">
                    <Link href={`/admin/newsletter/${row.id}`}>{row.subject.trim() || 'Untitled'}</Link>
                    {row.article_id && (
                      <span className="hint" style={{ display: 'block', margin: '2px 0 0' }}>
                        Also an article on the website
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`badge${row.status === 'draft' ? '' : ' solid'}`}>{STATUS[row.status]}</span>
                  </td>
                  <td className="num">{row.status === 'draft' ? '—' : `${row.sent_count} of ${row.total}`}</td>
                  <td className="num">{row.status === 'draft' ? '—' : row.failed_count}</td>
                  <td className="meta" style={{ fontSize: 13 }}>
                    {formatDateTime(row.finished_at ?? row.updated_at)}
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
