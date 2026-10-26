import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { getTopics } from '@/lib/queries'
import { one, plural } from '@/lib/utils'
import { createTopic, deleteTopic, updateTopic } from '../actions'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function AdminTopics({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin()
  const sp = await searchParams
  const message = one(sp.message)
  const error = one(sp.error)
  const topics = await getTopics()

  return (
    <>
      <div className="admin-head">
        <h1>Topics</h1>
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

      <form action={createTopic} className="inline" style={{ marginBottom: 24, maxWidth: 640 }}>
        <div className="field">
          <label htmlFor="new-topic">New topic</label>
          <input id="new-topic" name="name" className="input" placeholder="e.g. Leadership" required maxLength={60} />
        </div>
        <button type="submit" className="btn">
          Add topic
        </button>
      </form>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>URL</th>
              <th>Order</th>
              <th>Articles</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {topics.map((topic) => (
              <tr key={topic.id}>
                <td colSpan={3} style={{ padding: 0 }}>
                  <form action={updateTopic} style={{ display: 'grid', gridTemplateColumns: 'minmax(140px,2fr) minmax(140px,2fr) 70px auto', gap: 8, padding: '8px 12px', alignItems: 'center' }}>
                    <input type="hidden" name="id" value={topic.id} />
                    <label className="sr-only" htmlFor={`name-${topic.id}`}>
                      Name
                    </label>
                    <input id={`name-${topic.id}`} name="name" className="input" defaultValue={topic.name} required maxLength={60} />
                    <label className="sr-only" htmlFor={`slug-${topic.id}`}>
                      URL slug
                    </label>
                    <input id={`slug-${topic.id}`} name="slug" className="input" defaultValue={topic.slug} />
                    <label className="sr-only" htmlFor={`order-${topic.id}`}>
                      Order
                    </label>
                    <input id={`order-${topic.id}`} name="sort_order" type="number" className="input" defaultValue={topic.sort_order} />
                    <button type="submit" className="link-btn">
                      Save
                    </button>
                  </form>
                </td>
                <td>
                  <Link href={`/topics/${topic.slug}`}>{plural(topic.article_count, 'article')}</Link>
                </td>
                <td>
                  <details className="danger-zone">
                    <summary>Delete</summary>
                    <form action={deleteTopic}>
                      <input type="hidden" name="id" value={topic.id} />
                      <p className="hint" style={{ margin: '0 0 8px' }}>
                        Articles stay published; they just lose this topic.
                      </p>
                      <button type="submit" className="btn btn-danger">
                        Delete “{topic.name}”
                      </button>
                    </form>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">Order controls how topics are listed across the site (lowest first).</p>
    </>
  )
}
