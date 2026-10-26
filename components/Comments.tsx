import Link from 'next/link'
import { deleteComment } from '@/app/articles/[slug]/comment-actions'
import { formatDate } from '@/lib/format'
import type { Comment, Profile } from '@/lib/types'
import CommentForm from './CommentForm'
import '@/app/articles/[slug]/comments.css'

// Comments under an article: signed-in readers can post, and delete their own; admins can delete any.
export default function Comments({
  articleId,
  slug,
  comments,
  profile,
}: {
  articleId: string
  slug: string
  comments: Comment[]
  profile: Profile | null
}) {
  const next = encodeURIComponent(`/articles/${slug}#comments`)
  const isAdmin = profile?.role === 'admin'
  const count = comments.length

  return (
    <section id="comments" className="comments" aria-labelledby="comments-title">
      <h2 id="comments-title" className="comments-title">
        Comments{count > 0 && <span className="comments-count">{count}</span>}
      </h2>

      {count > 0 ? (
        <ol className="comment-list">
          {comments.map((comment) => (
            <li key={comment.id} className="comment">
              <p className="comment-head">
                <span className="comment-name">{comment.author_name || 'Reader'}</span>
                {comment.by_admin && <span className="comment-badge">Author</span>}
                <time dateTime={comment.created_at}>{formatDate(comment.created_at)}</time>
              </p>
              <p className="comment-body">{comment.body}</p>
              {profile && (comment.user_id === profile.id || isAdmin) && (
                <form action={deleteComment} className="comment-delete">
                  <input type="hidden" name="id" value={comment.id} />
                  <input type="hidden" name="slug" value={slug} />
                  <button type="submit" className="link-btn">
                    Delete
                  </button>
                </form>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="comments-empty">No comments yet.{profile ? ' Start the conversation.' : ''}</p>
      )}

      {!profile ? (
        <p className="comments-signin">
          <Link href={`/login?next=${next}`} className="text-link">
            Sign in
          </Link>{' '}
          or{' '}
          <Link href={`/signup?next=${next}`} className="text-link">
            create a free account
          </Link>{' '}
          to comment.
        </p>
      ) : profile.status !== 'active' ? (
        <p className="comments-signin">Your account can’t comment right now.</p>
      ) : (
        <CommentForm articleId={articleId} slug={slug} askName={!profile.display_name?.trim()} />
      )}
    </section>
  )
}
