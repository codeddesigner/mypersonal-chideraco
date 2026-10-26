import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { EVENT_LABELS, EVENT_NAMES, type EventName } from '@/lib/analytics'
import { createClient } from '@/lib/supabase/server'

export default async function AdminOverview() {
  await requireAdmin()
  const supabase = await createClient()
  const now = new Date().toISOString()

  const [published, drafts, scheduled, readers, subscribers, summary, top] = await Promise.all([
    supabase.from('articles').select('id', { count: 'exact', head: true }).eq('status', 'published').lte('published_at', now),
    supabase.from('articles').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
    supabase.from('articles').select('id', { count: 'exact', head: true }).eq('status', 'published').gt('published_at', now),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .in('status', ['active', 'trialing'])
      .or(`current_period_end.is.null,current_period_end.gt."${now}"`),
    supabase.rpc('event_summary', { p_days: 30 }),
    supabase.rpc('top_articles', { p_days: 30, p_limit: 8 }),
  ])

  const counts = new Map<string, number>()
  for (const row of (summary.data ?? []) as unknown as { name: string; total: number }[]) counts.set(row.name, Number(row.total))
  const count = (name: EventName) => counts.get(name) ?? 0
  const views = count('article_viewed')
  const created = count('account_created')
  const conversion = views > 0 ? `${((created / views) * 100).toFixed(1)}%` : '—'
  const topRows = (top.data ?? []) as unknown as { article_id: string; title: string; slug: string; views: number; read_more: number }[]

  const stats = [
    { n: published.count ?? 0, l: 'Published articles' },
    { n: drafts.count ?? 0, l: 'Drafts' },
    { n: scheduled.count ?? 0, l: 'Scheduled' },
    { n: readers.count ?? 0, l: 'Registered readers' },
    { n: subscribers.count ?? 0, l: 'Active subscribers' },
  ]

  return (
    <>
      <div className="admin-head">
        <h1>Overview</h1>
        <Link href="/admin/articles/new" className="btn">
          New article
        </Link>
      </div>

      <div className="stats">
        {stats.map((s) => (
          <div className="stat" key={s.l}>
            <div className="n">{s.n}</div>
            <div className="l">{s.l}</div>
          </div>
        ))}
      </div>

      <h2>Last 30 days</h2>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Event</th>
              <th className="num">Count</th>
            </tr>
          </thead>
          <tbody>
            {EVENT_NAMES.map((name) => (
              <tr key={name}>
                <td>{EVENT_LABELS[name]}</td>
                <td className="num">{count(name)}</td>
              </tr>
            ))}
            <tr>
              <td>Accounts created per article view</td>
              <td className="num">{conversion}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Most-read articles (30 days)</h2>
      {topRows.length > 0 ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Article</th>
                <th className="num">Views</th>
                <th className="num">Read-more clicks</th>
              </tr>
            </thead>
            <tbody>
              {topRows.map((row) => (
                <tr key={row.article_id}>
                  <td className="title-cell">
                    <Link href={`/articles/${row.slug}`}>{row.title}</Link>
                  </td>
                  <td className="num">{Number(row.views)}</td>
                  <td className="num">{Number(row.read_more)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="meta">No article views recorded yet.</p>
      )}
    </>
  )
}
