'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isUuid } from '@/lib/utils'

export type CommentState = { error?: string; posted?: number } | null

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
const MAX = 2000

function slugOf(formData: FormData): string {
  const slug = String(formData.get('slug') ?? '')
  return SLUG.test(slug) ? slug : ''
}

// Posts a comment as the signed-in reader. The database checks they can read the article,
// copies their name onto the comment and limits how many they can post in a few minutes.
export async function postComment(_previous: CommentState, formData: FormData): Promise<CommentState> {
  const articleId = String(formData.get('article_id') ?? '')
  const slug = slugOf(formData)
  const body = String(formData.get('body') ?? '').trim()
  if (!isUuid(articleId) || !slug) return { error: 'Something went wrong. Reload the page and try again.' }
  if (!body) return { error: 'Write your comment first.' }
  if (body.length > MAX) return { error: `Keep it under ${MAX.toLocaleString()} characters.` }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sign in to comment.' }

  // Readers without a name on their account add one the first time they comment.
  const name = formData.get('name')
  if (typeof name === 'string') {
    const clean = name.trim().slice(0, 80)
    if (!clean) return { error: 'Add the name to show with your comment.' }
    const { error: nameError } = await supabase.from('profiles').update({ display_name: clean }).eq('id', user.id)
    if (nameError) return { error: 'Your name couldn’t be saved. Please try again.' }
  }

  const { error } = await supabase.from('article_comments').insert({ article_id: articleId, body })
  if (error) {
    if (error.message.includes('too_many_comments')) return { error: 'That’s a lot of comments in a few minutes. Try again shortly.' }
    return { error: 'Your comment couldn’t be posted. Please try again.' }
  }

  revalidatePath(`/articles/${slug}`)
  return { posted: Date.now() }
}

// The comment's author and admins can delete it; the database refuses anyone else.
export async function deleteComment(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const slug = slugOf(formData)
  if (!isUuid(id) || !slug) return
  const supabase = await createClient()
  await supabase.from('article_comments').delete().eq('id', id)
  revalidatePath(`/articles/${slug}`)
}
