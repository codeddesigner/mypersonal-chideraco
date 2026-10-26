'use client'

import Link from 'next/link'
import { useLayoutEffect, useRef, useState, useTransition, type ChangeEvent } from 'react'
import { deleteArticle, saveArticle } from '@/app/admin/actions'
import { emailArticle } from '@/app/admin/newsletter-actions'
import ArticleBodyEditor from '@/components/ArticleBodyEditor'
import ColorWheel from '@/components/ColorWheel'
import Cover from '@/components/Cover'
import { ACCENTS, ACCENT_KEYS, INK, WHITE, isAccent, normaliseHex, paletteFor, readability, readabilityOf, textFor, type AccentKey } from '@/lib/accent'
import { COVER_STYLES, coverStyleFor, coverSvg } from '@/lib/cover'
import { formatDateTime, toLocalInput } from '@/lib/format'
import { createClient } from '@/lib/supabase/client'
import { ACCESS_LABELS, type AccessLevel, type ArticleStatus } from '@/lib/types'
import { plural, slugify } from '@/lib/utils'
import '@/app/admin/editor.css'

export type EditorArticle = {
  id: string
  title: string
  slug: string
  description: string
  preview: string
  body: string
  status: ArticleStatus
  published_at: string | null
  access: AccessLevel
  featured: boolean
  topic_ids: string[]
  cover_image_url: string | null
  cover_alt: string
  accent: string | null
  cover_style: string | null
  text_colour: string | null
  // Minutes set by hand; null means worked out from the length.
  reading_minutes_set: number | null
}

type TopicOption = { id: string; name: string }
// The latest newsletter made from this article (Email to subscribers), if there is one.
export type EditorNewsletter = { id: string; status: 'draft' | 'sending' | 'sent'; finished_at: string | null }

const NL = String.fromCharCode(10)
const WHITESPACE = new RegExp(`[ ${String.fromCharCode(9, 10, 13)}]+`)
const MANY_BREAKS = new RegExp(`${NL}{2,}`, 'g')

const TEXT_CHOICES = [
  { value: '', name: 'Automatic', className: 'swatch-text-auto' },
  { value: INK.toLowerCase(), name: 'Dark', className: '' },
  { value: WHITE, name: 'White', className: '' },
]

function statusLabel(status: ArticleStatus, publishedAt: string | null) {
  if (status === 'published' && publishedAt && new Date(publishedAt) > new Date()) return 'Scheduled'
  if (status === 'published') return 'Published'
  if (status === 'archived') return 'Archived'
  return 'Draft'
}

export default function ArticleEditor({
  article,
  topics,
  notice,
  newsletter = null,
  subscriberCount = 0,
}: {
  article?: EditorArticle
  topics: TopicOption[]
  notice?: string
  newsletter?: EditorNewsletter | null
  subscriberCount?: number
}) {
  const [title, setTitle] = useState(article?.title ?? '')
  const [slug, setSlug] = useState(article?.slug ?? '')
  const [slugEdited, setSlugEdited] = useState(Boolean(article))
  const [description, setDescription] = useState(article?.description ?? '')
  const [body, setBody] = useState(article?.body ?? '')
  const [preview, setPreview] = useState(article?.preview ?? '')
  const [access, setAccess] = useState<AccessLevel>(article?.access ?? 'members')
  const [featured, setFeatured] = useState(article?.featured ?? false)
  const [topicIds, setTopicIds] = useState<string[]>(article?.topic_ids ?? [])
  const [publishedAt, setPublishedAt] = useState(toLocalInput(article?.published_at))
  const [coverUrl, setCoverUrl] = useState(article?.cover_image_url ?? '')
  const [coverAlt, setCoverAlt] = useState(article?.cover_alt ?? '')
  const [accent, setAccent] = useState<string>(article?.accent ?? '')
  const [coverStyle, setCoverStyle] = useState<string>(article?.cover_style ?? '')
  const [textColour, setTextColour] = useState<string>(article?.text_colour ?? '')
  const [readTime, setReadTime] = useState(article?.reading_minutes_set ? String(article.reading_minutes_set) : '')
  const [uploadingCover, setUploadingCover] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(notice ?? null)
  const [pending, startTransition] = useTransition()
  const titleRef = useRef<HTMLTextAreaElement>(null)

  // The title box grows with the title, in browsers that don't size it automatically.
  useLayoutEffect(() => {
    const el = titleRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [title])

  const status = article?.status ?? 'draft'
  const isLive = status === 'published'
  const words = body.trim() ? body.trim().split(WHITESPACE).length : 0
  // The read time: the one typed in, or worked out from the length at 230 words a minute.
  const autoMinutes = Math.max(1, Math.ceil(words / 230))
  const chosenMinutes = Number.parseInt(readTime, 10)
  const minutes = chosenMinutes >= 1 && chosenMinutes <= 600 ? chosenMinutes : autoMinutes

  function submit(intent: 'publish' | 'draft' | 'save' | 'archive' | 'preview') {
    setError(null)
    setMessage(null)
    if (!title.trim()) {
      setError('Add a title.')
      return
    }
    const form = new FormData()
    if (article) form.set('id', article.id)
    form.set('intent', intent)
    form.set('title', title)
    form.set('slug', slugify(slug || title))
    form.set('description', description)
    form.set('body', body)
    form.set('preview', preview)
    form.set('access', access)
    form.set('featured', featured ? '1' : '')
    form.set('published_at', publishedAt)
    form.set('cover_image_url', coverUrl)
    form.set('cover_alt', coverAlt)
    form.set('accent', accent)
    form.set('cover_style', coverStyle)
    form.set('text_colour', textColour)
    form.set('reading_minutes_set', readTime)
    topicIds.forEach((id) => form.append('topics', id))

    startTransition(async () => {
      const result = await saveArticle(form)
      if (result?.error) setError(result.error)
      else if (result?.message) setMessage(result.message)
    })
  }

  // Makes a newsletter draft from the saved article and opens it (or opens the unsent one there already).
  function emailIt() {
    if (!article) return
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const result = await emailArticle(article.id)
      if (result?.error) setError(result.error)
    })
  }

  function remove() {
    if (!article) return
    startTransition(async () => {
      const result = await deleteArticle(article.id)
      if (result?.error) setError(result.error)
    })
  }

  async function upload(file: File): Promise<string> {
    const supabase = createClient()
    const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
    const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('article-images').upload(path, file, { contentType: file.type, upsert: false })
    if (uploadError) throw uploadError
    const { data } = supabase.storage.from('article-images').getPublicUrl(path)
    return data.publicUrl as string
  }

  const altFromName = (name: string) => name.replace(/[.][^.]+$/, '').replace(/[-_]+/g, ' ')

  async function onCover(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    setUploadingCover(true)
    setError(null)
    try {
      const url = await upload(file)
      setCoverUrl(url)
      if (!coverAlt) setCoverAlt(altFromName(file.name))
      setMessage('Cover uploaded. Save the article to keep it.')
    } catch (err) {
      setError(err instanceof Error ? `Cover upload failed: ${err.message}` : 'Cover upload failed.')
    } finally {
      setUploadingCover(false)
      input.value = ''
    }
  }

  function toggleTopic(id: string) {
    setTopicIds((current) => (current.includes(id) ? current.filter((t) => t !== id) : [...current, id]))
  }

  const palette = paletteFor(accent || null, slug || title || 'new-article')
  const seed = slug || title || 'new-article'
  const wheelValue = isAccent(accent) ? ACCENTS[accent].base.toLowerCase() : accent
  // The text colour as readers will see it, and how readable it is on the article's colour.
  const shownText = textFor(palette.base, textColour || null)
  const verdict = readabilityOf(shownText, palette.base)
  const other = shownText.toLowerCase() === WHITE ? INK : WHITE
  const otherIsBetter = readability(other, palette.base) > readability(shownText, palette.base) + 8
  const customText = textColour && !TEXT_CHOICES.some((choice) => choice.value === textColour) ? textColour : ''
  const titleLines = title.split(NL).filter((line) => line.trim())

  return (
    <div className="editor-wrap">
      {/* The title comes first, across the full width, as it will lead the article. */}
      <div className="field editor-title">
        <label htmlFor="title">Title</label>
        <textarea
          id="title"
          ref={titleRef}
          className="input input-title"
          value={title}
          maxLength={300}
          rows={1}
          placeholder="The article’s title"
          aria-describedby="title-hint"
          onChange={(e) => {
            // Enter breaks the title onto a new line on the article page; one break at a time, at most four lines.
            const next = e.target.value.replace(MANY_BREAKS, NL).split(NL).slice(0, 4).join(NL)
            setTitle(next)
            if (!slugEdited) setSlug(slugify(next))
          }}
        />
        <p className="hint" id="title-hint">
          Press Enter where you’d like the title to break. It breaks the same way on the article page and in article lists.
        </p>
      </div>

      {error && (
        <p className="notice error" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      )}
      {message && (
        <p className="notice success" role="status" style={{ margin: 0 }}>
          {message}
        </p>
      )}

    <div className="editor">
      <div className="editor-main">
        <div className="field">
          <label htmlFor="slug">URL</label>
          <div className="slug-row">
            <span>/articles/</span>
            <input
              id="slug"
              className="input"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value)
                setSlugEdited(true)
              }}
              onBlur={() => setSlug((s) => slugify(s))}
            />
          </div>
          {isLive && <p className="hint">Changing the URL of a published article breaks links people have already shared.</p>}
        </div>

        <div className="field">
          <label htmlFor="description">Short description</label>
          <textarea id="description" className="input" rows={2} maxLength={600} value={description} onChange={(e) => setDescription(e.target.value)} />
          <p className="hint">One or two sentences, shown in article lists, search results and link previews. Press Enter for a new line.</p>
        </div>

        <div className="field">
          <ArticleBodyEditor value={body} onChange={setBody} uploadImage={upload} onError={setError} />
          <p className="hint">
            For a heading, type ## and a space at the start of a line (### for a subheading), or use the Heading buttons; each
            heading is labelled in the margin. Select words to make them bold, italic or a link. Enter starts a new paragraph;
            Shift+Enter starts a new line inside one. Text pasted from Google Docs or Word keeps its headings, bold, italic, links
            and lists. {words.toLocaleString()} words, {minutes} min read{readTime ? ' (set by you)' : ''}.
          </p>
        </div>

        <div className="field">
          <label htmlFor="preview">Public preview</label>
          <textarea id="preview" className="input" rows={5} value={preview} onChange={(e) => setPreview(e.target.value)} />
          <p className="hint">What visitors see before signing in. Each Enter starts a new paragraph. Leave empty to use the first two paragraphs.</p>
        </div>
      </div>

      <aside className="side">
        <div className="panel">
          <p className="panel-title">{statusLabel(status, article?.published_at ?? null)}</p>
          <div className="actions-col">
            {isLive ? (
              <>
                <button type="button" className="btn" disabled={pending} onClick={() => submit('save')}>
                  {pending ? 'Saving…' : 'Update'}
                </button>
                <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => submit('draft')}>
                  Unpublish
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn" disabled={pending} onClick={() => submit('publish')}>
                  {pending ? 'Saving…' : publishedAt && fromNow(publishedAt) ? 'Schedule' : 'Publish'}
                </button>
                <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => submit('draft')}>
                  Save draft
                </button>
              </>
            )}
            <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => submit('preview')}>
              Save &amp; preview
            </button>
          </div>
          {article && isLive && (
            <Link href={`/articles/${article.slug}`} className="link-btn" target="_blank">
              View on site
            </Link>
          )}
        </div>

        {article && (
          <div className="panel">
            <p className="field-label" style={{ margin: 0 }}>
              Email to subscribers
            </p>
            {newsletter && newsletter.status !== 'draft' ? (
              <>
                <p className="hint" style={{ margin: 0 }}>
                  {newsletter.status === 'sent'
                    ? `Emailed to subscribers ${formatDateTime(newsletter.finished_at ?? '')}.`
                    : 'Being emailed to subscribers. Open the newsletter to see how far it has got.'}
                </p>
                <Link href={`/admin/newsletter/${newsletter.id}`} className="link-btn">
                  See the newsletter
                </Link>
              </>
            ) : newsletter ? (
              <>
                <p className="hint" style={{ margin: 0 }}>
                  There’s a newsletter of this article waiting to be sent.
                </p>
                <Link href={`/admin/newsletter/${newsletter.id}`} className="btn btn-secondary">
                  Open the newsletter
                </Link>
              </>
            ) : (
              <>
                <p className="hint" style={{ margin: 0 }}>
                  Turns this article into a newsletter for your {plural(subscriberCount, 'subscriber')}, ready for you to check and send. It
                  uses the version you last saved.
                  {article.access !== 'public' &&
                    ` Only ${article.access === 'members' ? 'registered readers' : 'subscribers'} can read the full article, so the email has the preview and a link to the rest.`}
                </p>
                <button type="button" className="btn btn-secondary" disabled={pending} onClick={emailIt}>
                  Email to subscribers
                </button>
              </>
            )}
          </div>
        )}

        <div className="panel">
          <div className="field">
            <label htmlFor="published_at">Publication date</label>
            <input id="published_at" type="datetime-local" className="input" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} />
            <p className="hint">Lagos time. Empty means now; a future date schedules it.</p>
          </div>

          <div className="field">
            <label htmlFor="read_time">Read time</label>
            <div className="read-time">
              <input
                id="read_time"
                type="number"
                inputMode="numeric"
                min={1}
                max={600}
                step={1}
                className="input"
                value={readTime}
                placeholder={String(autoMinutes)}
                aria-describedby="read-time-hint"
                onChange={(e) => setReadTime(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
              />
              <span>min</span>
            </div>
            <p className="hint" id="read-time-hint">
              {readTime
                ? `Shown as “${minutes} min read”. Empty the box to go back to the automatic ${autoMinutes} min.`
                : `Worked out from the length: ${autoMinutes} min. Type a number to set your own.`}
            </p>
          </div>

          <div className="field">
            <label htmlFor="access">Who can read the full article</label>
            <select id="access" className="input" value={access} onChange={(e) => setAccess(e.target.value as AccessLevel)}>
              {(['members', 'subscribers', 'public'] as AccessLevel[]).map((level) => (
                <option key={level} value={level}>
                  {ACCESS_LABELS[level]}
                </option>
              ))}
            </select>
            <p className="hint">Everyone can always see the title, description and preview.</p>
          </div>

          <label className="check">
            <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
            <span>Feature on the homepage (replaces the current one)</span>
          </label>
        </div>

        <div className="panel">
          <p className="field-label" style={{ margin: 0 }}>
            Cover
          </p>
          <Cover
            article={{ slug: seed, accent: accent || null, cover_image_url: coverUrl || null, cover_alt: coverAlt, cover_style: coverStyle || null }}
            className="cover-preview"
            sizes="300px"
          />
          <div className="row-actions">
            <label className="link-btn" style={{ cursor: uploadingCover ? 'progress' : 'pointer' }}>
              {uploadingCover ? 'Uploading…' : coverUrl ? 'Replace image' : 'Upload an image'}
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onCover} disabled={uploadingCover} hidden />
            </label>
            {coverUrl && (
              <button type="button" className="link-btn danger" onClick={() => setCoverUrl('')}>
                Remove image
              </button>
            )}
          </div>
          {coverUrl ? (
            <div className="field">
              <label htmlFor="cover_alt">Image description</label>
              <input id="cover_alt" className="input" value={coverAlt} maxLength={300} onChange={(e) => setCoverAlt(e.target.value)} />
              <p className="hint">Read aloud by screen readers. Describe what the photo shows.</p>
            </div>
          ) : (
            <p className="hint">Without an image, the article gets the artwork you choose below, in its colour.</p>
          )}

          <fieldset className="cover-styles">
            <legend className="field-label">Artwork</legend>
            <label className="cover-style" title="Automatic">
              <input type="radio" name="cover_style" value="" checked={!coverStyle} onChange={() => setCoverStyle('')} />
              <span
                className="cover-style-art"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: coverSvg(seed, palette, coverStyleFor(null, seed)) }}
              />
              <span className="cover-style-name">Automatic</span>
            </label>
            {COVER_STYLES.map((style) => (
              <label key={style.id} className="cover-style" title={style.name}>
                <input type="radio" name="cover_style" value={style.id} checked={coverStyle === style.id} onChange={() => setCoverStyle(style.id)} />
                <span className="cover-style-art" aria-hidden="true" dangerouslySetInnerHTML={{ __html: coverSvg(seed, palette, style.id) }} />
                <span className="cover-style-name">{style.name}</span>
              </label>
            ))}
          </fieldset>
          {coverUrl && <p className="hint">The uploaded image is shown instead while it’s there.</p>}

          <fieldset className="swatches">
            <legend className="field-label">Colour</legend>
            <label className="swatch" title="Automatic">
              <input type="radio" name="accent" value="" checked={!accent} onChange={() => setAccent('')} />
              <span className="swatch-chip swatch-auto" aria-hidden="true" />
              <span className="sr-only">Automatic</span>
            </label>
            {ACCENT_KEYS.map((key: AccentKey) => (
              <label key={key} className="swatch" title={ACCENTS[key].name}>
                <input type="radio" name="accent" value={key} checked={accent === key} onChange={() => setAccent(key)} />
                <span className="swatch-chip" style={{ background: ACCENTS[key].base }} aria-hidden="true" />
                <span className="sr-only">{ACCENTS[key].name}</span>
              </label>
            ))}
          </fieldset>
          <ColorWheel value={wheelValue} onChange={setAccent} />
          <p className="hint">
            Pick a ready colour or any colour on the wheel; the slider makes it lighter or darker. It’s used for the article’s header,
            its card and its artwork.
          </p>

          <fieldset className="swatches">
            <legend className="field-label">Text colour</legend>
            {TEXT_CHOICES.map((choice) => (
              <label key={choice.name} className="swatch" title={choice.name}>
                <input
                  type="radio"
                  name="text_colour"
                  value={choice.value}
                  checked={textColour === choice.value}
                  onChange={() => setTextColour(choice.value)}
                />
                <span
                  className={`swatch-chip ${choice.className}`.trim()}
                  style={choice.value ? { background: choice.value } : undefined}
                  aria-hidden="true"
                />
                <span className="swatch-name">{choice.name}</span>
              </label>
            ))}
            <label className="swatch" title="Any colour">
              <input
                type="color"
                className="swatch-picker"
                value={customText || (shownText.length === 7 ? shownText.toLowerCase() : '#142218')}
                onChange={(e) => setTextColour(normaliseHex(e.target.value) || '')}
                aria-label="Any text colour"
              />
              <span className={`swatch-chip swatch-text-custom${customText ? ' is-chosen' : ''}`} style={customText ? { background: customText } : undefined} aria-hidden="true" />
              <span className="swatch-name">Other</span>
            </label>
          </fieldset>

          {/* How the header will look: the article's colour with its text on it. */}
          <div className="text-sample" style={{ background: palette.base, color: shownText }}>
            <span className="text-sample-meta">{minutes} min read</span>
            <span className="text-sample-title">
              {titleLines.length ? titleLines.map((line, i) => <span key={i}>{line}</span>) : 'The article’s title'}
            </span>
            <span className="text-sample-desc">{description.trim() || 'The short description sits under the title.'}</span>
          </div>
          <p className={`readability readability-${verdict.level}`} role="status">
            <span className="readability-dot" aria-hidden="true" />
            {verdict.label}.
            {verdict.level !== 'good' && otherIsBetter && (
              <>
                {' '}
                <button type="button" className="link-btn" onClick={() => setTextColour(other === WHITE ? WHITE : INK.toLowerCase())}>
                  Try {other === WHITE ? 'white' : 'dark'} text
                </button>
              </>
            )}
          </p>
          {!textColour && <p className="hint">Automatic uses dark or white text, whichever reads better on the colour.</p>}
        </div>

        <div className="panel">
          <p className="field-label" style={{ margin: 0 }}>
            Topics
          </p>
          {topics.length > 0 ? (
            <div className="checks">
              {topics.map((topic) => (
                <label key={topic.id} className="check">
                  <input type="checkbox" checked={topicIds.includes(topic.id)} onChange={() => toggleTopic(topic.id)} />
                  <span>{topic.name}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="hint">
              No topics yet. <Link href="/admin/topics">Add some</Link>.
            </p>
          )}
        </div>

        {article && (
          <details className="danger-zone">
            <summary>Delete article</summary>
            <p className="hint" style={{ marginBottom: 10 }}>
              This can’t be undone. To hide the article but keep it, use Archive instead.
            </p>
            <div className="row-actions">
              {status !== 'archived' && (
                <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => submit('archive')}>
                  Archive
                </button>
              )}
              <button type="button" className="btn btn-danger" disabled={pending} onClick={remove}>
                Delete permanently
              </button>
            </div>
          </details>
        )}
      </aside>
    </div>
    </div>
  )
}

function fromNow(localValue: string) {
  const d = new Date(`${localValue}:00+01:00`)
  return !Number.isNaN(d.getTime()) && d.getTime() > Date.now() + 60000
}
