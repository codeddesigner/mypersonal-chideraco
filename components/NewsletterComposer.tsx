'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import {
  deleteNewsletter,
  publishNewsletterOnSite,
  retryFailedNewsletter,
  saveNewsletter,
  sendNextBatch,
  sendTestNewsletter,
  startNewsletter,
  type LinkedArticle,
  type Progress,
} from '@/app/admin/newsletter-actions'
import BodyEditor from '@/components/BodyEditor'
import Cover from '@/components/Cover'
import { ACCENTS, ACCENT_KEYS, isAccent, type AccentKey } from '@/lib/accent'
import { COVER_STYLES } from '@/lib/cover'
import { formatDateTime } from '@/lib/format'
import { coverSeed, emailCover, newsletterHtml, type CoverMode, type NewsletterCover } from '@/lib/newsletter-email'
import { createClient } from '@/lib/supabase/client'
import { ACCESS_LABELS, type AccessLevel } from '@/lib/types'
import { plural } from '@/lib/utils'

export type ComposerNewsletter = NewsletterCover & {
  id: string
  subject: string
  preheader: string
  body: string
  status: 'draft' | 'sending' | 'sent'
  test_sent_to: string | null
  test_sent_at: string | null
  updated_at: string
  started_at: string | null
  finished_at: string | null
}
export type Failure = { email: string; error: string | null }

type Props = {
  newsletter: ComposerNewsletter
  activeCount: number
  progress: Progress | null
  failures: Failure[]
  canSend: boolean
  adminEmail: string
  siteUrl: string
  brand: string
  // The article this newsletter came from, or was published as.
  article: LinkedArticle | null
  notice?: string
}

// Where a newsletter goes. Once it's linked to an article, it's already on the site and only the email is left.
type Where = 'email' | 'both' | 'site'
const WHERE: { value: Where; label: string; hint: string }[] = [
  { value: 'email', label: 'Email only', hint: 'Sent to your subscribers. It doesn’t appear on the website.' },
  { value: 'both', label: 'Email and website', hint: 'Sent to your subscribers and published on the website as an article.' },
  { value: 'site', label: 'Website only', hint: 'Published on the website as an article. Nothing is emailed.' },
]
const LEVELS: AccessLevel[] = ['public', 'members', 'subscribers']
const COVER_MODES: { value: CoverMode; label: string }[] = [
  { value: 'art', label: 'Artwork' },
  { value: 'image', label: 'Image' },
  { value: 'none', label: 'None' },
]
// “… published on the website for …”
const READERS: Record<AccessLevel, string> = { public: 'everyone to read', members: 'registered readers', subscribers: 'subscribers only' }

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
// Resend trouble this many times in a row and the page stops and offers Resume.
const MAX_TROUBLE = 8

// The email as subscribers will see it, in a frame sized to its content. No scripts run inside it.
function EmailPreview({ html }: { html: string }) {
  const [width, setWidth] = useState<'computer' | 'phone'>('computer')
  const frame = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(640)
  const fit = useCallback(() => {
    const doc = frame.current?.contentDocument
    if (doc?.documentElement) setHeight(doc.documentElement.scrollHeight + 2)
  }, [])
  useEffect(() => {
    const id = requestAnimationFrame(fit)
    return () => cancelAnimationFrame(id)
  }, [width, html, fit])

  return (
    <div className="nl-preview">
      <div className="nl-preview-bar">
        <span className="hint" style={{ margin: 0 }}>
          Exactly as subscribers get it. The unsubscribe link is added for each person.
        </span>
        <div className="body-tabs" role="tablist" aria-label="Preview size">
          <button type="button" role="tab" aria-selected={width === 'computer'} onClick={() => setWidth('computer')}>
            Computer
          </button>
          <button type="button" role="tab" aria-selected={width === 'phone'} onClick={() => setWidth('phone')}>
            Phone
          </button>
        </div>
      </div>
      <div className={`nl-preview-stage is-${width}`}>
        <iframe
          ref={frame}
          title="Email preview"
          srcDoc={html}
          sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          onLoad={fit}
          style={{ height }}
        />
      </div>
    </div>
  )
}

function ProgressPanel({ progress }: { progress: Progress }) {
  const done = progress.sent + progress.failed + progress.skipped
  const pct = progress.total > 0 ? Math.round((done / progress.total) * 100) : 0
  return (
    <>
      <div className="nl-bar" role="progressbar" aria-label="Sending progress" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={done}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="nl-bar-label">
        {done} of {progress.total} done ({pct}%)
      </p>
      <dl className="nl-counts">
        <div>
          <dt>Delivered to Resend</dt>
          <dd>{progress.sent}</dd>
        </div>
        <div>
          <dt>Failed</dt>
          <dd>{progress.failed}</dd>
        </div>
        <div>
          <dt>Unsubscribed before sending</dt>
          <dd>{progress.skipped}</dd>
        </div>
        <div>
          <dt>Still to send</dt>
          <dd>{progress.waiting}</dd>
        </div>
      </dl>
    </>
  )
}

function articleState(article: LinkedArticle): { live: boolean; text: string } {
  if (article.status === 'published' && article.published_at && Date.parse(article.published_at) > Date.now()) {
    return { live: false, text: `Scheduled for ${formatDateTime(article.published_at)}.` }
  }
  if (article.status === 'published') return { live: true, text: `Live on the website for ${READERS[article.access]}.` }
  if (article.status === 'archived') return { live: false, text: 'Archived, so it isn’t on the website.' }
  return { live: false, text: 'Still a draft, so it isn’t on the website yet.' }
}

// The article that goes with this newsletter, with links to it.
function ArticleNote({ article, draft }: { article: LinkedArticle; draft: boolean }) {
  const state = articleState(article)
  const title = article.title.replace(/\s+/g, ' ').trim() || 'Untitled'
  return (
    <div className="nl-article">
      <p className="nl-article-title">
        <span className="hint">Article</span>
        <Link href={`/admin/articles/${article.id}`}>{title}</Link>
      </p>
      <p className="hint" style={{ margin: 0 }}>
        {state.text}
        {draft && !state.live && ' Links to it in this email won’t work until it’s live.'}
        {draft && ' Changes here only change the email, not the article.'}
      </p>
      <div className="row-actions">
        {state.live && (
          <Link href={`/articles/${article.slug}`} className="link-btn" target="_blank">
            View on site
          </Link>
        )}
        <Link href={`/admin/articles/${article.id}`} className="link-btn">
          Edit article
        </Link>
      </div>
    </div>
  )
}

export default function NewsletterComposer({
  newsletter,
  activeCount,
  progress: serverProgress,
  failures,
  canSend,
  adminEmail,
  siteUrl,
  brand,
  article: linkedArticle,
  notice,
}: Props) {
  const router = useRouter()
  const id = newsletter.id
  const [subject, setSubject] = useState(newsletter.subject)
  const [preheader, setPreheader] = useState(newsletter.preheader)
  const [body, setBody] = useState(newsletter.body)
  // The cover: the generated artwork (a design and colour), an uploaded image, or none.
  const [coverMode, setCoverMode] = useState<CoverMode>(newsletter.cover_mode)
  const [coverUrl, setCoverUrl] = useState(newsletter.cover_image_url ?? '')
  const [coverAlt, setCoverAlt] = useState(newsletter.cover_alt ?? '')
  const [coverStyle, setCoverStyle] = useState(newsletter.cover_style ?? '')
  const [accent, setAccent] = useState(newsletter.accent ?? '')
  const [uploadingCover, setUploadingCover] = useState(false)
  const coverSettings = { cover_mode: coverMode, cover_image_url: coverUrl || null, cover_alt: coverAlt, cover_style: coverStyle || null, accent: accent || null }
  const coverKey = JSON.stringify(coverSettings)
  const [saved, setSaved] = useState({ subject: newsletter.subject, preheader: newsletter.preheader, body: newsletter.body, cover: coverKey })
  const [savedAt, setSavedAt] = useState(newsletter.updated_at)
  const [status, setStatus] = useState(newsletter.status)
  const [progress, setProgress] = useState<Progress | null>(serverProgress)
  const [error, setError] = useState('')
  const [message, setMessage] = useState(notice ?? '')
  const [busy, setBusy] = useState<'' | 'save' | 'test' | 'start' | 'delete' | 'retry' | 'publish'>('')
  const [article, setArticle] = useState(linkedArticle)
  const [where, setWhere] = useState<Where>('email')
  const [access, setAccess] = useState<AccessLevel>('public')
  const [running, setRunning] = useState(false)
  const [note, setNote] = useState('')
  const [testTo, setTestTo] = useState(newsletter.test_sent_to || adminEmail)
  const [lastTest, setLastTest] = useState(newsletter.test_sent_at ? { to: newsletter.test_sent_to ?? '', at: newsletter.test_sent_at } : null)
  // The words that went out in the last test, so the send confirmation can say if they've changed since.
  const [testedWords, setTestedWords] = useState(() => {
    const t = newsletter.test_sent_at ? Date.parse(newsletter.test_sent_at) : 0
    const fresh = t > 0 && Date.parse(newsletter.updated_at) - t < 3000
    return fresh ? JSON.stringify([newsletter.subject, newsletter.preheader, newsletter.body, coverKey]) : ''
  })
  const confirm = useRef<HTMLDialogElement>(null)
  const alive = useRef(true)
  const runningRef = useRef(false)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  // After the page reloads its data (when sending finishes), take the server's figures.
  useEffect(() => {
    if (runningRef.current) return
    setStatus(newsletter.status)
    setProgress(serverProgress)
  }, [newsletter.status, serverProgress])

  const content = { subject, preheader, body }
  const words = JSON.stringify([subject, preheader, body, coverKey])
  const dirty = subject !== saved.subject || preheader !== saved.preheader || body !== saved.body || coverKey !== saved.cover
  const locked = status !== 'draft'
  // Linked to an article means it's already on the site, so only the email is left to send.
  const mode: Where = article ? 'email' : where
  const emails = mode !== 'site'
  const seed = coverSeed({ cover_seed: newsletter.cover_seed }, subject)
  const cover = emailCover({ ...coverSettings, cover_seed: newsletter.cover_seed }, subject, siteUrl)
  const coverSrc = cover?.url ?? ''
  const coverText = cover?.alt ?? ''
  // A colour carried over from an article that isn't one of the ready colours, so it can be picked again.
  const ownColour = newsletter.accent && !isAccent(newsletter.accent) ? newsletter.accent : ''
  const html = useMemo(
    () =>
      newsletterHtml(
        { subject, preheader, body, cover: coverSrc ? { url: coverSrc, alt: coverText } : null },
        { siteUrl, brand, unsubscribeUrl: `${siteUrl}/unsubscribe` }
      ),
    [subject, preheader, body, coverSrc, coverText, siteUrl, brand]
  )

  // Leaving with unsaved words, or in the middle of sending, asks first.
  useEffect(() => {
    if (!dirty && !running) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, running])

  function clearNotes() {
    setError('')
    setMessage('')
  }

  async function save(): Promise<boolean> {
    if (!dirty) return true
    setBusy('save')
    const result = await saveNewsletter(id, { ...content, coverSettings })
    setBusy('')
    if (result.error) {
      setError(result.error)
      return false
    }
    setSaved({ ...content, cover: coverKey })
    if (result.savedAt) setSavedAt(result.savedAt)
    return true
  }

  async function onSave() {
    clearNotes()
    if (await save()) setMessage('Draft saved.')
  }

  async function onTest() {
    clearNotes()
    if (!subject.trim() || !body.trim()) {
      setError('Add a subject and a message first.')
      return
    }
    if (!(await save())) return
    setBusy('test')
    const result = await sendTestNewsletter(id, testTo)
    setBusy('')
    if (result.error) {
      setError(result.error)
      return
    }
    setMessage(result.message ?? 'Test sent.')
    setLastTest({ to: testTo.trim().toLowerCase(), at: new Date().toISOString() })
    setTestedWords(words)
  }

  async function onOpenConfirm() {
    clearNotes()
    if (!subject.trim() || !body.trim()) {
      setError(mode === 'site' ? 'Add a subject and a message before publishing.' : 'Add a subject and a message before sending.')
      return
    }
    if (!(await save())) return
    confirm.current?.showModal()
  }

  const run = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    setRunning(true)
    setError('')
    setNote('')
    let trouble = 0
    try {
      while (alive.current) {
        const step = await sendNextBatch(id)
        if (step.progress) setProgress(step.progress)
        if (step.error) {
          setError(step.error)
          break
        }
        if (step.done) {
          setStatus('sent')
          router.refresh()
          break
        }
        trouble = step.trouble ? trouble + 1 : 0
        setNote(step.note ?? '')
        if (trouble >= MAX_TROUBLE) {
          setError('Resend isn’t answering right now. Nothing is lost: press Resume sending in a few minutes and it carries on where it stopped.')
          break
        }
        if (step.waitMs) await sleep(step.waitMs)
      }
    } catch {
      setError('The connection dropped. Press Resume sending to carry on. Nobody gets the newsletter twice.')
    } finally {
      runningRef.current = false
      if (alive.current) {
        setRunning(false)
        setNote('')
      }
    }
  }, [id, router])

  async function onSend() {
    confirm.current?.close()
    clearNotes()
    // The article goes up first: if that fails, nothing has been emailed yet.
    if (mode !== 'email') {
      setBusy('publish')
      const published = await publishNewsletterOnSite(id, access, mode)
      // Website only opens the new article in the editor, so this carries on only after an error.
      setBusy('')
      if (published?.article) setArticle(published.article)
      if (published?.error) {
        setError(published.error)
        return
      }
      if (mode === 'site') return
    }
    setBusy('start')
    const result = await startNewsletter(id)
    setBusy('')
    if (result.error) {
      setError(mode === 'both' ? `It’s on the website now, but the email hasn’t gone out: ${result.error}` : result.error)
      return
    }
    const total = result.total ?? 0
    setStatus('sending')
    setProgress({ total, sent: 0, failed: 0, skipped: 0, waiting: total, status: 'sending' })
    void run()
  }

  async function onRetry() {
    clearNotes()
    setBusy('retry')
    const result = await retryFailedNewsletter(id)
    setBusy('')
    if (result.error) {
      setError(result.error)
      return
    }
    if (!result.count) return
    setStatus('sending')
    void run()
  }

  // For a newsletter that has already gone out: put it on the website too.
  async function onPublishSent() {
    clearNotes()
    setBusy('publish')
    const result = await publishNewsletterOnSite(id, access, 'both')
    setBusy('')
    if (result.article) setArticle(result.article)
    if (result.error) setError(result.error)
    else setMessage(result.message ?? 'Published on the website.')
  }

  async function onDelete() {
    if (!window.confirm('Delete this draft? This can’t be undone.')) return
    clearNotes()
    setBusy('delete')
    const result = await deleteNewsletter(id)
    setBusy('')
    if (result?.error) setError(result.error)
  }

  async function upload(file: File): Promise<string> {
    const supabase = createClient()
    const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
    const path = `newsletter/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('article-images').upload(path, file, { contentType: file.type, upsert: false })
    if (uploadError) throw uploadError
    return supabase.storage.from('article-images').getPublicUrl(path).data.publicUrl as string
  }

  async function onCover(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    setUploadingCover(true)
    setError('')
    try {
      setCoverUrl(await upload(file))
      if (!coverAlt) setCoverAlt(file.name.replace(/[.][^.]+$/, '').replace(/[-_]+/g, ' '))
    } catch (err) {
      setError(err instanceof Error ? `Cover upload failed: ${err.message}` : 'Cover upload failed.')
    } finally {
      setUploadingCover(false)
      input.value = ''
    }
  }

  const testedCurrent = testedWords !== '' && testedWords === words
  const statusLabel = status === 'draft' ? 'Draft' : status === 'sent' ? 'Sent' : running ? 'Sending…' : 'Paused'

  return (
    <div className="editor-wrap nl">
      <div className="nl-head">
        <p className="back" style={{ margin: 0 }}>
          <Link href="/admin/newsletter">← All newsletters</Link>
        </p>
        <span className={`badge${status === 'draft' ? '' : ' solid'}`}>{statusLabel}</span>
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

      {!locked ? (
        <div className="editor">
          <div className="editor-main">
            <div className="field">
              <label htmlFor="nl-subject">Subject</label>
              <input
                id="nl-subject"
                className="input nl-subject"
                maxLength={200}
                value={subject}
                placeholder="What this newsletter is about"
                onChange={(e) => setSubject(e.target.value)}
              />
              <p className="hint">The subject line in the inbox, also shown as the email’s heading.</p>
            </div>

            <div className="field">
              <label htmlFor="nl-preheader">Preview text (optional)</label>
              <input
                id="nl-preheader"
                className="input"
                maxLength={200}
                value={preheader}
                placeholder="A line to go with the subject"
                onChange={(e) => setPreheader(e.target.value)}
              />
              <p className="hint">Many email apps show this next to the subject before the email is opened.</p>
            </div>

            <div className="field">
              <BodyEditor
                fieldLabel="Message"
                value={body}
                onChange={setBody}
                uploadImage={upload}
                onError={setError}
                placeholder="Write your newsletter. Press Enter for a new paragraph."
                renderPreview={() => <EmailPreview html={html} />}
              />
              <p className="hint">
                Use the buttons for headings, bold, italic, links, lists and quotes. Press Preview to see the email as subscribers will.
              </p>
            </div>
          </div>

          <aside className="side">
            <div className="panel">
              <p className="panel-title">{article ? 'Send' : 'Where it goes'}</p>
              {article ? (
                <ArticleNote article={article} draft />
              ) : (
                <fieldset className="nl-where">
                  <legend className="sr-only">Where it goes</legend>
                  {WHERE.map((option) => (
                    <label key={option.value} className="nl-where-option">
                      <input type="radio" name="nl-where" value={option.value} checked={where === option.value} onChange={() => setWhere(option.value)} />
                      <span>
                        <span className="nl-where-label">{option.label}</span>
                        <span className="hint">{option.hint}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}
              {mode !== 'email' && (
                <div className="field">
                  <label htmlFor="nl-access">Who can read it on the website</label>
                  <select id="nl-access" className="input" value={access} onChange={(e) => setAccess(e.target.value as AccessLevel)}>
                    {LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {ACCESS_LABELS[level]}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {emails && (
                <p className="nl-audience">
                  Goes to <strong>{plural(activeCount, 'active subscriber')}</strong>.
                </p>
              )}
              <div className="actions-col">
                <button type="button" className="btn" disabled={busy !== '' || (emails && (!canSend || activeCount === 0))} onClick={onOpenConfirm}>
                  {busy === 'start'
                    ? 'Starting…'
                    : busy === 'publish'
                      ? 'Publishing…'
                      : mode === 'site'
                        ? 'Publish on the website'
                        : mode === 'both'
                          ? 'Send and publish'
                          : 'Send newsletter'}
                </button>
                <button type="button" className="btn btn-secondary" disabled={busy !== '' || !dirty} onClick={onSave}>
                  {busy === 'save' ? 'Saving…' : dirty ? 'Save draft' : 'Saved'}
                </button>
              </div>
              <p className="hint" style={{ margin: 0 }}>
                {dirty ? 'You have unsaved changes.' : `Saved ${formatDateTime(savedAt)}.`}
                {emails && activeCount === 0 && ' There’s no one to send to yet.'}
                {emails && !canSend && ' Sending is off until the email service is set up.'}
              </p>
            </div>

            <div className="panel">
              <p className="panel-title">Cover</p>
              <div className="nl-cover-modes" role="radiogroup" aria-label="Cover">
                {COVER_MODES.map((option) => (
                  <label key={option.value} className="nl-cover-mode">
                    <input
                      type="radio"
                      name="nl-cover"
                      value={option.value}
                      checked={coverMode === option.value}
                      onChange={() => setCoverMode(option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>

              {(coverMode === 'art' || (coverMode === 'image' && coverUrl)) && (
                <Cover
                  article={{
                    slug: seed,
                    accent: accent || null,
                    cover_image_url: coverMode === 'image' ? coverUrl : null,
                    cover_alt: coverAlt,
                    cover_style: coverStyle || null,
                  }}
                  className="cover-preview"
                  sizes="300px"
                />
              )}

              {coverMode === 'art' && (
                <>
                  <div className="field">
                    <label htmlFor="nl-art">Design</label>
                    <select id="nl-art" className="input" value={coverStyle} onChange={(e) => setCoverStyle(e.target.value)}>
                      <option value="">Automatic</option>
                      {COVER_STYLES.map((style) => (
                        <option key={style.id} value={style.id}>
                          {style.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <fieldset className="swatches">
                    <legend className="field-label">Colour</legend>
                    <label className="swatch" title="Automatic">
                      <input type="radio" name="nl-accent" value="" checked={!accent} onChange={() => setAccent('')} />
                      <span className="swatch-chip swatch-auto" aria-hidden="true" />
                      <span className="sr-only">Automatic</span>
                    </label>
                    {ownColour && (
                      <label className="swatch" title="The article’s colour">
                        <input type="radio" name="nl-accent" value={ownColour} checked={accent === ownColour} onChange={() => setAccent(ownColour)} />
                        <span className="swatch-chip" style={{ background: ownColour }} aria-hidden="true" />
                        <span className="sr-only">The article’s colour</span>
                      </label>
                    )}
                    {ACCENT_KEYS.map((key: AccentKey) => (
                      <label key={key} className="swatch" title={ACCENTS[key].name}>
                        <input type="radio" name="nl-accent" value={key} checked={accent === key} onChange={() => setAccent(key)} />
                        <span className="swatch-chip" style={{ background: ACCENTS[key].base }} aria-hidden="true" />
                        <span className="sr-only">{ACCENTS[key].name}</span>
                      </label>
                    ))}
                  </fieldset>
                </>
              )}

              {coverMode === 'image' && (
                <>
                  {!coverUrl && <div className="nl-cover-empty">No image yet</div>}
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
                  {coverUrl && (
                    <div className="field">
                      <label htmlFor="nl-cover-alt">Image description</label>
                      <input id="nl-cover-alt" className="input" value={coverAlt} maxLength={300} onChange={(e) => setCoverAlt(e.target.value)} />
                    </div>
                  )}
                </>
              )}

              <p className="hint" style={{ margin: 0 }}>
                {coverMode === 'none'
                  ? 'The email starts with the subject.'
                  : coverMode === 'image' && !coverUrl
                    ? 'Upload an image, or the email goes out without a cover.'
                    : article
                      ? 'Shown at the top of the email.'
                      : 'Shown at the top of the email, and used as the article’s cover if you publish it on the website.'}
              </p>
            </div>

            <div className="panel">
              <p className="panel-title">Send a test</p>
              <div>
                <label htmlFor="nl-test" className="sr-only">
                  Send the test to
                </label>
                <input
                  id="nl-test"
                  type="email"
                  className="input"
                  value={testTo}
                  autoComplete="email"
                  onChange={(e) => setTestTo(e.target.value)}
                />
              </div>
              <button type="button" className="btn btn-secondary" disabled={!canSend || busy !== ''} onClick={onTest}>
                {busy === 'test' ? 'Sending test…' : 'Send test'}
              </button>
              <p className="hint" style={{ margin: 0 }}>
                {lastTest
                  ? `Last test went to ${lastTest.to}, ${formatDateTime(lastTest.at)}.`
                  : 'Check it in a real inbox before it goes out. The subject starts with [Test].'}
              </p>
            </div>

            <button type="button" className="link-btn danger nl-delete" disabled={busy !== ''} onClick={onDelete}>
              Delete draft
            </button>
          </aside>
        </div>
      ) : (
        <div className="editor nl-sent">
          <div className="editor-main">
            <div className="nl-sent-head">
              <p className="field-label">Subject</p>
              <p className="nl-sent-subject">{subject}</p>
              {preheader && <p className="hint">Preview text: {preheader}</p>}
            </div>
            <EmailPreview html={html} />
          </div>

          <aside className="side">
            <div className="panel" aria-live="polite">
              <p className="panel-title">{statusLabel}</p>
              {progress && <ProgressPanel progress={progress} />}
              {status === 'sending' && !running && (
                <>
                  <button type="button" className="btn" disabled={!canSend} onClick={() => void run()}>
                    Resume sending
                  </button>
                  <p className="hint" style={{ margin: 0 }}>
                    Sending stopped before everyone got it. Resume carries on with the people still waiting; nobody gets it twice.
                  </p>
                </>
              )}
              {running && (
                <p className="hint" style={{ margin: 0 }}>
                  {note || 'Sending in batches of 50.'} Keep this page open until it finishes. If it closes, come back and press Resume.
                </p>
              )}
              {status === 'sent' && (
                <p className="hint" style={{ margin: 0 }}>
                  Finished {formatDateTime(newsletter.finished_at ?? new Date().toISOString())}.
                </p>
              )}
              {status === 'sent' && (progress?.failed ?? 0) > 0 && (
                <button type="button" className="btn btn-secondary" disabled={busy !== '' || !canSend} onClick={onRetry}>
                  {busy === 'retry' ? 'Retrying…' : (progress?.failed ?? 0) === 1 ? 'Try the failed address again' : `Try the ${progress?.failed} failed addresses again`}
                </button>
              )}
            </div>
            <div className="panel">
              <p className="panel-title">On the website</p>
              {article ? (
                <ArticleNote article={article} draft={false} />
              ) : (
                <>
                  <p className="hint" style={{ margin: 0 }}>
                    This newsletter was only emailed. Publish it as an article so people can find it on the website too.
                  </p>
                  <div className="field">
                    <label htmlFor="nl-access-sent">Who can read it</label>
                    <select id="nl-access-sent" className="input" value={access} onChange={(e) => setAccess(e.target.value as AccessLevel)}>
                      {LEVELS.map((level) => (
                        <option key={level} value={level}>
                          {ACCESS_LABELS[level]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button type="button" className="btn btn-secondary" disabled={busy !== ''} onClick={onPublishSent}>
                    {busy === 'publish' ? 'Publishing…' : 'Publish on the website'}
                  </button>
                </>
              )}
            </div>
            {lastTest && (
              <p className="hint" style={{ margin: 0 }}>
                Last test went to {lastTest.to}, {formatDateTime(lastTest.at)}.
              </p>
            )}
          </aside>
        </div>
      )}

      {locked && failures.length > 0 && (
        <section aria-labelledby="nl-failed">
          <h2 id="nl-failed">Couldn’t be sent</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {failures.map((failure) => (
                  <tr key={failure.email}>
                    <td>{failure.email}</td>
                    <td style={{ fontSize: 13 }}>{failure.error ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <dialog ref={confirm} className="nl-confirm" aria-labelledby="nl-confirm-title">
        <h2 id="nl-confirm-title" className="nl-confirm-title">
          {mode === 'site'
            ? 'Publish on the website?'
            : mode === 'both'
              ? `Send to ${plural(activeCount, 'subscriber')} and publish?`
              : `Send to ${plural(activeCount, 'subscriber')}?`}
        </h2>
        {mode === 'site' ? (
          <p>
            “{subject.trim()}” becomes an article on the website for {READERS[access]}. Nothing is emailed. The draft moves to Articles,
            where you can add a cover and topics.
          </p>
        ) : mode === 'both' ? (
          <p>
            “{subject.trim()}” goes to everyone on the list straight away and is published on the website for {READERS[access]}. Once the
            email is sent, it can’t be unsent or changed.
          </p>
        ) : (
          <p>
            “{subject.trim()}” goes to everyone on the list straight away. Once it’s sent, it can’t be unsent or changed.
          </p>
        )}
        {emails && !testedCurrent && <p className="notice">You haven’t sent yourself a test of this version yet. You can cancel and send one first.</p>}
        <div className="nl-confirm-actions">
          <button type="button" className="btn btn-secondary" onClick={() => confirm.current?.close()}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={onSend}>
            {mode === 'site' ? 'Publish' : mode === 'both' ? 'Send and publish' : `Send to ${plural(activeCount, 'person').replace('persons', 'people')}`}
          </button>
        </div>
      </dialog>
    </div>
  )
}
