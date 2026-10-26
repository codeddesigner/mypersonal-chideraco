import ArticleEditor from '@/components/ArticleEditor'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export default async function NewArticlePage() {
  await requireAdmin()
  const supabase = await createClient()
  const { data } = await supabase.from('topics').select('id,name').order('sort_order').order('name')
  const topics = (data ?? []) as unknown as { id: string; name: string }[]

  return (
    <>
      <div className="admin-head">
        <h1>New article</h1>
      </div>
      <ArticleEditor topics={topics} />
    </>
  )
}
