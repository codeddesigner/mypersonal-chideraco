'use client'

import { useState, type ChangeEvent } from 'react'
import { createClient } from '@/lib/supabase/client'

const MAX_BYTES = 5 * 1024 * 1024

type Note = { kind: 'success' | 'error'; text: string } | null

const PORTRAIT_HINT =
  'A PNG with a transparent background works best. It stands in the bottom-right corner of the small yellow card, so crop it flat at the bottom. PNG, JPEG or WebP, up to 5 MB.'

// Upload a new picture to the image store, or go back to the original drawing.
// The chosen link travels with the surrounding form and is applied when that form is saved.
// Defaults are for the home page portrait; the About page passes its own names and wording.
export default function PortraitField({
  defaultUrl,
  fallbackSrc,
  defaultAlt,
  urlName = 'portrait_url',
  altName = 'portrait_alt',
  prefix = 'portrait',
  uploadLabel = 'Upload a new portrait',
  resetLabel = 'Use the original portrait',
  hint = PORTRAIT_HINT,
}: {
  defaultUrl: string
  fallbackSrc: string
  defaultAlt: string
  urlName?: string
  altName?: string
  prefix?: string
  uploadLabel?: string
  resetLabel?: string
  hint?: string
}) {
  const [url, setUrl] = useState(defaultUrl)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<Note>(null)

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    if (file.size > MAX_BYTES) {
      setNote({ kind: 'error', text: 'That file is over 5 MB. Export a smaller PNG or JPEG and try again.' })
      input.value = ''
      return
    }
    setBusy(true)
    setNote(null)
    try {
      const supabase = createClient()
      const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
      const path = `site/${prefix}-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('article-images').upload(path, file, { contentType: file.type, upsert: false })
      if (error) throw error
      const { data } = supabase.storage.from('article-images').getPublicUrl(path)
      setUrl(data.publicUrl as string)
      setNote({ kind: 'success', text: 'Uploaded. Save this page to put it live.' })
    } catch (err) {
      setNote({ kind: 'error', text: err instanceof Error ? `Upload failed: ${err.message}` : 'Upload failed.' })
    } finally {
      setBusy(false)
      input.value = ''
    }
  }

  function resetToOriginal() {
    setUrl('')
    setNote({ kind: 'success', text: 'Back to the original. Save this page to apply it.' })
  }

  return (
    <div className="portrait-field">
      <div className="portrait-preview">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url || fallbackSrc} alt="" />
      </div>
      <div className="portrait-controls">
        <input type="hidden" name={urlName} value={url} />
        <div className="portrait-actions">
          <label className="btn btn-secondary">
            {busy ? 'Uploading…' : uploadLabel}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} disabled={busy} className="sr-only" />
          </label>
          {url && (
            <button type="button" className="link-btn" onClick={resetToOriginal}>
              {resetLabel}
            </button>
          )}
        </div>
        <p className="hint">{hint}</p>
        <div className="field">
          <label htmlFor={altName}>Description for screen readers</label>
          <input id={altName} name={altName} className="input" defaultValue={defaultAlt} maxLength={200} />
        </div>
        {note && (
          <p className={`notice ${note.kind}`} role="status">
            {note.text}
          </p>
        )}
      </div>
    </div>
  )
}
