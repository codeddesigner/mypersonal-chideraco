'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { postComment, type CommentState } from '@/app/articles/[slug]/comment-actions'

const MAX = 2000

export default function CommentForm({ articleId, slug, askName }: { articleId: string; slug: string; askName: boolean }) {
  const [state, action, pending] = useActionState<CommentState, FormData>(postComment, null)
  const [length, setLength] = useState(0)
  const form = useRef<HTMLFormElement>(null)

  // Clear the box once the comment is up.
  useEffect(() => {
    if (state?.posted) {
      form.current?.reset()
      setLength(0)
    }
  }, [state?.posted])

  return (
    <form ref={form} action={action} className="comment-form">
      <input type="hidden" name="article_id" value={articleId} />
      <input type="hidden" name="slug" value={slug} />
      {askName && (
        <div className="field">
          <label htmlFor="comment-name">Your name</label>
          <input id="comment-name" name="name" className="input" maxLength={80} autoComplete="name" required />
          <p className="hint">Shown with your comment. You can change it later in your account.</p>
        </div>
      )}
      <div className="field">
        <label htmlFor="comment-body">Your comment</label>
        <textarea
          id="comment-body"
          name="body"
          className="input"
          rows={4}
          maxLength={MAX}
          required
          onChange={(event) => setLength(event.target.value.length)}
          aria-describedby="comment-count"
        />
        <p className="hint" id="comment-count">
          {length > MAX - 200 ? `${(MAX - length).toLocaleString()} characters left` : 'Be kind. Comments are public to readers of this article.'}
        </p>
      </div>
      {state?.error && (
        <p className="notice error" role="alert">
          {state.error}
        </p>
      )}
      {state?.posted && !pending && (
        <p className="notice success" role="status">
          Comment posted.
        </p>
      )}
      <div>
        <button type="submit" className="btn" disabled={pending}>
          {pending ? 'Posting…' : 'Post comment'}
        </button>
      </div>
    </form>
  )
}
