import Link from 'next/link'
import { notFound } from 'next/navigation'
import ArticleEditor, { type EditorArticle, type EditorNewsletter } from '@/components/ArticleEditor'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { isUuid, one } from '@/lib/utils'

type Params = Promise<{ id: string }>
type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function EditArticlePage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  await requireAdmin()
  const { id } = await params
  const sp = await searchParams
  if (!isUuid(id)) notFound()

  const supabase = await createClient()
  const [articleRes, bodyRes, linksRes, topicsRes, newsletterRes, activeRes] = await Promise.all([
    supabase.from('articles').select('id,title,slug,description,preview,status,published_at,access,featured,cover_image_url,cover_alt,accent,cover_style,text_colour,reading_minutes_set').eq('id', id).maybeSingle(),
    supabase.from('article_bodies').select('body').eq('article_id', id).maybeSingle(),
    supabase.from('article_topics').select('topic_id').eq('article_id', id),
    supabase.from('topics').select('id,name').order('sort_order').order('name'),
    // The latest newsletter made from this article, or that it was published from.
    supabase.from('newsletter_campaigns').select('id,status,finished_at').eq('article_id', id).order('created_at', { ascending: false }).limit(1),
    supabase.from('newsletter_subscribers').select('id', { count: 'exact', head: true }).eq('status', 'active'),
  ])

  const row = articleRes.data as unknown as Omit<EditorArticle, 'body' | 'topic_ids'> | null
  if (!row) notFound()

  const article: EditorArticle = {
    ...row,
    description: row.description ?? '',
    preview: row.preview ?? '',
    cover_image_url: row.cover_image_url ?? null,
    cover_alt: row.cover_alt ?? '',
    accent: row.accent ?? null,
    cover_style: row.cover_style ?? null,
    text_colour: row.text_colour ?? null,
    reading_minutes_set: typeof row.reading_minutes_set === 'number' ? row.reading_minutes_set : null,
    body: (bodyRes.data as unknown as { body: string } | null)?.body ?? '',
    topic_ids: ((linksRes.data ?? []) as unknown as { topic_id: string }[]).map((l) => l.topic_id),
  }
  const topics = (topicsRes.data ?? []) as unknown as { id: string; name: string }[]
  const newsletter = ((newsletterRes.data ?? []) as unknown as EditorNewsletter[])[0] ?? null
  const notice = one(sp.created)
    ? 'Article created.'
    : one(sp.from) === 'newsletter'
      ? 'Published on the website from your newsletter. Add a cover and topics here if you like, then press Update.'
      : undefined

  return (
    <>
      <div className="admin-head">
        <h1>Edit article</h1>
        <Link href={`/admin/articles/${id}/preview`} className="link-btn">
          Preview
        </Link>
      </div>
      <ArticleEditor
        key={article.id}
        article={article}
        topics={topics}
        notice={notice}
        newsletter={newsletter}
        subscriberCount={activeRes.count ?? 0}
      />
    </>
  )
}
