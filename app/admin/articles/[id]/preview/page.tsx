import Link from 'next/link'
import { notFound } from 'next/navigation'
import ArticleView from '@/components/ArticleView'
import { requireAdmin } from '@/lib/auth'
import { formatDateTime } from '@/lib/format'
import { getArticleBody, getArticleById } from '@/lib/queries'
import { isUuid } from '@/lib/utils'

type Params = Promise<{ id: string }>

export default async function PreviewArticlePage({ params }: { params: Params }) {
  await requireAdmin()
  const { id } = await params
  if (!isUuid(id)) notFound()

  const [article, body] = await Promise.all([getArticleById(id), getArticleBody(id)])
  if (!article) notFound()

  const scheduled = article.status === 'published' && article.published_at && new Date(article.published_at) > new Date()
  const state = scheduled
    ? `Scheduled for ${formatDateTime(article.published_at)}`
    : article.status === 'published'
      ? 'Published'
      : article.status === 'archived'
        ? 'Archived'
        : 'Draft'

  return (
    <>
      <div className="preview-banner" role="status">
        Preview · {state} · <Link href={`/admin/articles/${id}`}>Back to editor</Link>
      </div>
      <ArticleView article={article} body={body ?? ''} />
    </>
  )
}
