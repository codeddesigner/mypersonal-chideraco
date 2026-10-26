'use client'

import { useState, type ChangeEvent } from 'react'
import { createClient } from '@/lib/supabase/client'

export type RepeatField = {
  key: string
  label: string
  placeholder?: string
  hint?: string
  multiline?: boolean
  rows?: number
  wide?: boolean
  // An uploaded picture (a logo, say). The field holds its https:// link.
  image?: boolean
}

type Row = { id: number; values: Record<string, string> }

const MAX_IMAGE_BYTES = 2 * 1024 * 1024
// Photos and logos are shrunk in the browser before they're stored, so the site never sends a huge file.
// A logo shows at most 68 pixels wide; 512 leaves room for sharp screens.
const MAX_RAW_BYTES = 25 * 1024 * 1024
const MAX_SIDE = 512

async function shrink(file: File): Promise<Blob> {
  if (!/^image[/](png|jpeg|webp)$/.test(file.type)) return file
  const url = URL.createObjectURL(file)
  try {
    const picture = new Image()
    picture.src = url
    try {
      await picture.decode()
    } catch {
      throw new Error('the picture is too large to open here. Save it at about 1000 pixels wide and try again.')
    }
    const scale = Math.min(1, MAX_SIDE / Math.max(picture.naturalWidth, picture.naturalHeight))
    if (scale === 1) return file
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(picture.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(picture.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) return file
    context.imageSmoothingQuality = 'high'
    context.drawImage(picture, 0, 0, canvas.width, canvas.height)
    const smaller = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, file.type, 0.9))
    return smaller ?? file
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Text boxes grow with what's typed, so a second line is visible as soon as Enter is pressed.
function fit(box: HTMLTextAreaElement | null) {
  if (!box) return
  box.style.height = 'auto'
  box.style.height = `${box.scrollHeight + 3}px`
}

// Uploads one picture to the image store and hands back its public link.
function ImageInput({ id, value, label, onChange }: { id: string; value: string; label: string; onChange: (url: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    if (file.size > (file.type === 'image/svg+xml' ? MAX_IMAGE_BYTES : MAX_RAW_BYTES)) {
      setError('That file is too big. Use a smaller PNG, SVG or JPEG.')
      input.value = ''
      return
    }
    setBusy(true)
    setError('')
    try {
      const upload = await shrink(file)
      if (upload.size > MAX_IMAGE_BYTES) throw new Error('the picture is still over 2 MB after shrinking. Try a smaller one.')
      const supabase = createClient()
      const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
      const path = `site/logo-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('article-images').upload(path, upload, { contentType: file.type, upsert: false })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('article-images').getPublicUrl(path)
      onChange(data.publicUrl as string)
    } catch (err) {
      setError(err instanceof Error ? `Upload failed: ${err.message}` : 'Upload failed.')
    } finally {
      setBusy(false)
      input.value = ''
    }
  }

  return (
    <div className="image-input">
      <div className="image-input-preview">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {value ? <img src={value} alt="" /> : <span className="hint">None</span>}
      </div>
      <div className="image-input-actions">
        <label className="btn btn-secondary">
          {busy ? 'Uploading…' : value ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
          <input id={id} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={onFile} disabled={busy} className="sr-only" />
        </label>
        {value && (
          <button type="button" className="link-btn danger" onClick={() => onChange('')}>
            Remove
          </button>
        )}
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

// A list of entries (roles, services, hobbies…) that can be added, edited, reordered and removed.
// The whole list travels with the form as JSON in one hidden field; the server cleans it before saving.
export default function RepeatableField({
  name,
  fields,
  initial,
  addLabel,
  itemLabel,
  max,
}: {
  name: string
  fields: RepeatField[]
  initial: Record<string, string>[]
  addLabel: string
  itemLabel: string
  max: number
}) {
  const [rows, setRows] = useState<Row[]>(() => initial.map((values, id) => ({ id, values: { ...values } })))

  const blank = () => Object.fromEntries(fields.map((field) => [field.key, ''])) as Record<string, string>
  const serialised = JSON.stringify(rows.map((row) => row.values))

  function edit(id: number, key: string, value: string) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, values: { ...row.values, [key]: value } } : row)))
  }

  function add() {
    // Ids only need to be unique within the list, so the next one is one past the largest.
    setRows((current) => [...current, { id: current.reduce((top, row) => Math.max(top, row.id), -1) + 1, values: blank() }])
  }

  function remove(id: number) {
    setRows((current) => current.filter((row) => row.id !== id))
  }

  function move(index: number, step: -1 | 1) {
    setRows((current) => {
      const target = index + step
      if (target < 0 || target >= current.length) return current
      const copy = [...current]
      const [row] = copy.splice(index, 1)
      copy.splice(target, 0, row)
      return copy
    })
  }

  return (
    <div className="repeat">
      <input type="hidden" name={name} value={serialised} />
      {rows.length === 0 && <p className="hint repeat-empty">None yet. This stays hidden on the page until you add one.</p>}
      <ol className="repeat-list">
        {rows.map((row, index) => (
          <li key={row.id} className="repeat-item">
            <div className="repeat-head">
              <span className="note">
                {itemLabel} {index + 1}
              </span>
              <span className="repeat-tools">
                <button type="button" className="link-btn" onClick={() => move(index, -1)} disabled={index === 0}>
                  Move up
                </button>
                <button type="button" className="link-btn" onClick={() => move(index, 1)} disabled={index === rows.length - 1}>
                  Move down
                </button>
                <button type="button" className="link-btn danger" onClick={() => remove(row.id)}>
                  Remove
                </button>
              </span>
            </div>
            <div className="form-grid">
              {fields.map((field) => {
                const id = `${name}-${row.id}-${field.key}`
                const value = row.values[field.key] ?? ''
                return (
                  <div key={field.key} className={field.wide || field.multiline || field.image ? 'field span-2' : 'field'}>
                    {field.image ? (
                      <span className="field-label">{field.label}</span>
                    ) : (
                      <label htmlFor={id}>{field.label}</label>
                    )}
                    {field.image ? (
                      <ImageInput id={id} value={value} label={field.label} onChange={(url) => edit(row.id, field.key, url)} />
                    ) : (
                      // Every field takes line breaks: Enter starts a new line, and the page shows it there too.
                      <textarea
                        id={id}
                        ref={fit}
                        className="input repeat-text"
                        rows={field.rows ?? (field.multiline ? 3 : 1)}
                        value={value}
                        placeholder={field.placeholder}
                        onChange={(e) => {
                          edit(row.id, field.key, e.target.value)
                          fit(e.currentTarget)
                        }}
                      />
                    )}
                    {field.hint && <p className="hint">{field.hint}</p>}
                  </div>
                )
              })}
            </div>
          </li>
        ))}
      </ol>
      {rows.length < max && (
        <button type="button" className="btn btn-secondary" onClick={add}>
          {addLabel}
        </button>
      )}
    </div>
  )
}
