'use client'

import { useLayoutEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type KeyboardEvent, type ReactNode } from 'react'
import Prose from '@/components/Prose'
import { pastedText } from '@/lib/paste'

const NL = String.fromCharCode(10)
const LINE_PREFIX = /^(#{1,6} |> ?|[-*+] |[0-9]+[.)] )/
const LIST_LINE = /^( *)([-*+]|[0-9]+[.)]) (.*)$/
const QUOTE_LINE = /^> ?(.*)$/

type Props = {
  value: string
  onChange: (value: string) => void
  // Uploads a picture and returns its public address.
  uploadImage: (file: File) => Promise<string>
  onError: (message: string) => void
  // The newsletter composer reuses this box with its own name and its own preview.
  fieldLabel?: string
  placeholder?: string
  renderPreview?: (value: string) => ReactNode
}

const altFromName = (name: string) => name.replace(/[.][^.]+$/, '').replace(/[-_]+/g, ' ')

// The article text box: the words in the reading font, a row of formatting buttons, and a preview of
// the finished article. Enter starts a new paragraph; Shift+Enter starts a new line in the same one.
export default function BodyEditor({ value, onChange, uploadImage, onError, fieldLabel = 'Article', placeholder, renderPreview }: Props) {
  const area = useRef<HTMLTextAreaElement>(null)
  const [mode, setMode] = useState<'write' | 'preview'>('write')
  const [uploading, setUploading] = useState(false)

  // The box grows with the text, so the page scrolls instead of a small box inside it.
  useLayoutEffect(() => {
    const el = area.current
    if (!el || mode !== 'write') return
    const y = window.scrollY
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
    window.scrollTo({ top: y })
  }, [value, mode])

  // Replaces part of the text the way typing would, so Undo still works, then selects part of the result.
  function replace(start: number, end: number, text: string, select?: [number, number]) {
    const el = area.current
    if (!el) return
    const expected = el.value.slice(0, start) + text + el.value.slice(end)
    el.focus()
    el.setSelectionRange(start, end)
    try {
      if (text) document.execCommand('insertText', false, text)
      else if (start !== end) document.execCommand('delete')
    } catch {
      // Older browsers: the value is set directly below instead.
    }
    if (el.value !== expected) onChange(expected)
    const [from, to] = select ?? [text.length, text.length]
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + from, start + to)
    })
  }

  function selection() {
    const el = area.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    return { start, end, text: value.slice(start, end) }
  }

  // Bold and italic: wrap the selected words, or unwrap them if they're already wrapped.
  function toggleWrap(marker: string, placeholder: string) {
    let { start, end } = selection()
    // Spaces caught at the edges of a selection stay outside the formatting.
    while (start < end && value.charAt(start) === ' ') start++
    while (end > start && value.charAt(end - 1) === ' ') end--
    const text = value.slice(start, end)
    const m = marker.length
    const before = value.slice(start - m, start)
    const after = value.slice(end, end + m)
    const wrapped = before === marker && after === marker && (m === 2 || (value.charAt(start - 2) !== '*' && value.charAt(end + 1) !== '*'))
    if (wrapped) {
      replace(start - m, end + m, text, [0, text.length])
      return
    }
    if (text.startsWith(marker) && text.endsWith(marker) && text.length > 2 * m) {
      const inner = text.slice(m, text.length - m)
      replace(start, end, inner, [0, inner.length])
      return
    }
    const inner = text || placeholder
    replace(start, end, marker + inner + marker, [m, m + inner.length])
  }

  function link() {
    const { start, end, text } = selection()
    const looksLikeAddress = /^(https?:[/][/]|www[.])[^ ]+$/i.test(text.trim())
    if (looksLikeAddress) {
      const href = text.trim().startsWith('www.') ? `https://${text.trim()}` : text.trim()
      const out = `[link text](${href})`
      replace(start, end, out, [1, 10])
      return
    }
    const label = text || 'link text'
    const out = `[${label}](https://)`
    // Select the address so the link can be pasted straight in.
    replace(start, end, out, [label.length + 3, label.length + 11])
  }

  // Headings, quotes and lists apply to whole lines.
  function toggleLines(kind: 'h2' | 'h3' | 'quote' | 'list' | 'numbered') {
    const { start, end } = selection()
    const from = value.lastIndexOf(NL, start - 1) + 1
    const nextBreak = value.indexOf(NL, end > start && value.charAt(end - 1) === NL ? end - 1 : end)
    const to = nextBreak === -1 ? value.length : nextBreak
    const lines = value.slice(from, to).split(NL)
    const prefixFor = (i: number) =>
      kind === 'h2' ? '## ' : kind === 'h3' ? '### ' : kind === 'quote' ? '> ' : kind === 'list' ? '- ' : `${i + 1}. `
    const has = (line: string) =>
      kind === 'numbered' ? /^[0-9]+[.)] /.test(line) : kind === 'quote' ? /^> ?/.test(line) : line.startsWith(prefixFor(0))
    const filled = lines.filter((line) => line.trim())
    const removing = filled.length > 0 && filled.every(has)
    let n = 0
    const out = lines
      .map((line) => {
        if (!line.trim()) return line
        const bare = line.replace(LINE_PREFIX, '')
        return removing ? bare : prefixFor(n++) + bare
      })
      .join(NL)
    replace(from, to, out, [out.length, out.length])
  }

  function divider() {
    const { start, end } = selection()
    const atLineStart = start === 0 || value.charAt(start - 1) === NL
    const text = (atLineStart ? '' : NL) + '---' + NL
    replace(start, end, text)
  }

  async function onImage(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    const { start, end } = selection()
    setUploading(true)
    try {
      const url = await uploadImage(file)
      const atLineStart = start === 0 || value.charAt(start - 1) === NL
      replace(start, end, `${atLineStart ? '' : NL}![${altFromName(file.name)}](${url})${NL}`)
    } catch (err) {
      onError(err instanceof Error ? `Image upload failed: ${err.message}` : 'Image upload failed.')
    } finally {
      setUploading(false)
      input.value = ''
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) return
    const mod = event.metaKey || event.ctrlKey
    if (mod && !event.altKey) {
      const key = event.key.toLowerCase()
      if (key === 'b') {
        event.preventDefault()
        toggleWrap('**', 'bold text')
        return
      }
      if (key === 'i') {
        event.preventDefault()
        toggleWrap('*', 'italic text')
        return
      }
      if (key === 'k') {
        event.preventDefault()
        link()
        return
      }
    }
    if (event.key !== 'Enter' || mod || event.altKey) return
    const { start, end } = selection()
    if (event.shiftKey) {
      // A line break inside the paragraph (Markdown writes it as two spaces before the new line).
      event.preventDefault()
      replace(start, end, '  ' + NL)
      return
    }
    if (start !== end) return
    const lineStart = value.lastIndexOf(NL, start - 1) + 1
    const line = value.slice(lineStart, start)
    const item = LIST_LINE.exec(line)
    const quote = QUOTE_LINE.exec(line)
    if (item) {
      event.preventDefault()
      const [, indent, marker, text] = item
      if (!text.trim()) {
        // Enter on an empty item ends the list.
        replace(lineStart, start, '')
        return
      }
      const nextMarker = /^[0-9]/.test(marker) ? `${Number.parseInt(marker, 10) + 1}${marker.slice(-1)}` : marker
      replace(start, end, `${NL}${indent}${nextMarker} `)
    } else if (quote && line.startsWith('>')) {
      event.preventDefault()
      if (!quote[1].trim()) {
        replace(lineStart, start, '')
        return
      }
      replace(start, end, `${NL}> `)
    }
  }

  function onPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const text = pastedText(event.clipboardData)
    if (!text) return
    event.preventDefault()
    const { start, end } = selection()
    replace(start, end, text)
  }

  const tools: { label: string; title: string; run: () => void; className?: string }[] = [
    { label: 'Heading', title: 'Heading', run: () => toggleLines('h2') },
    { label: 'Subheading', title: 'Smaller heading', run: () => toggleLines('h3') },
    { label: 'B', title: 'Bold (Ctrl or ⌘ + B)', run: () => toggleWrap('**', 'bold text'), className: 'tool-bold' },
    { label: 'I', title: 'Italic (Ctrl or ⌘ + I)', run: () => toggleWrap('*', 'italic text'), className: 'tool-italic' },
    { label: 'Link', title: 'Link (Ctrl or ⌘ + K)', run: link },
    { label: 'Quote', title: 'Quote', run: () => toggleLines('quote') },
    { label: 'List', title: 'Bulleted list', run: () => toggleLines('list') },
    { label: '1. List', title: 'Numbered list', run: () => toggleLines('numbered') },
    { label: 'Divider', title: 'A dividing line', run: divider },
  ]

  return (
    <div className="body-editor">
      <div className="body-head">
        <label htmlFor="body" className="field-label">
          {fieldLabel}
        </label>
        <div className="body-tabs" role="tablist" aria-label="Write or preview">
          <button type="button" role="tab" aria-selected={mode === 'write'} onClick={() => setMode('write')}>
            Write
          </button>
          <button type="button" role="tab" aria-selected={mode === 'preview'} onClick={() => setMode('preview')}>
            Preview
          </button>
        </div>
      </div>

      {mode === 'write' ? (
        <>
          <div className="body-tools" role="toolbar" aria-label="Formatting" aria-controls="body">
            {tools.map((tool) => (
              <button
                key={tool.label}
                type="button"
                className={`body-tool ${tool.className ?? ''}`.trim()}
                title={tool.title}
                aria-label={tool.title}
                // Keep the text selected while the button is pressed.
                onMouseDown={(event) => event.preventDefault()}
                onClick={tool.run}
              >
                {tool.label}
              </button>
            ))}
            <label className="body-tool body-tool-image" title="Add a picture" style={{ cursor: uploading ? 'progress' : 'pointer' }}>
              {uploading ? 'Uploading…' : 'Picture'}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={onImage} disabled={uploading} hidden />
            </label>
          </div>
          <textarea
            id="body"
            ref={area}
            className="input body-text"
            value={value}
            spellCheck
            placeholder={placeholder ?? 'Start writing. Press Enter for a new paragraph.'}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
          />
        </>
      ) : (
        <div className="body-preview" aria-live="polite">
          {!value.trim() ? <p className="hint">Nothing written yet.</p> : renderPreview ? renderPreview(value) : <Prose source={value} />}
        </div>
      )}
    </div>
  )
}
