'use client'

import { useCallback, useEffect, useId, useRef, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { baseKeymap, chainCommands, exitCode, lift, setBlockType, toggleMark, wrapIn } from 'prosemirror-commands'
import { history, redo, undo } from 'prosemirror-history'
import { InputRule, inputRules, textblockTypeInputRule, undoInputRule, wrappingInputRule } from 'prosemirror-inputrules'
import { keymap } from 'prosemirror-keymap'
import { Fragment, Slice, type MarkType, type Node as DocNode, type NodeType } from 'prosemirror-model'
import { liftListItem, sinkListItem, splitListItem, wrapInList } from 'prosemirror-schema-list'
import { EditorState, Plugin, TextSelection, type Command } from 'prosemirror-state'
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view'
import BodyEditor from '@/components/BodyEditor'
import Prose from '@/components/Prose'
import { articleSchema, parseArticle, serializeArticle } from '@/lib/article-doc'
import { pastedText } from '@/lib/paste'

// The article text box, written the way the article will look (as on Medium): headings show as headings,
// quotes as quotes, lists as lists, in the article's own fonts. Each heading is labelled in the margin, so
// it's easy to see where they are. Headings can be made with the buttons, with Ctrl/⌘ + Alt + 2 or 3, or by
// typing ## (or ###) and a space at the start of a line. Selecting words brings up a small bar for bold,
// italic, links, headings and quotes. The text is still stored as Markdown (lib/article-doc.ts).

const { nodes, marks } = articleSchema

type Props = {
  value: string
  onChange: (value: string) => void
  // Uploads a picture and returns its public address.
  uploadImage: (file: File) => Promise<string>
  onError: (message: string) => void
}

type Block = 'text' | 'heading' | 'subheading' | 'other'
type Active = { block: Block; bold: boolean; italic: boolean; link: boolean; quote: boolean; list: 'bullet' | 'ordered' | null }
type Bubble = { left: number; top: number; below: boolean }

const BUBBLE_HALF = 200
const NONE: Active = { block: 'text', bold: false, italic: false, link: false, quote: false, list: null }
const altFromName = (name: string) => name.replace(/[.][^.]+$/, '').replace(/[-_]+/g, ' ')

/* What the selection is in ------------------------------------------------------------------------------- */

function markActive(state: EditorState, type: MarkType): boolean {
  const { from, to, empty, $from } = state.selection
  if (empty) return Boolean(type.isInSet(state.storedMarks ?? $from.marks()))
  return state.doc.rangeHasMark(from, to, type)
}

function blockOf(state: EditorState): Block {
  const parent = state.selection.$from.parent
  if (parent.type === nodes.paragraph) return 'text'
  if (parent.type === nodes.heading) return parent.attrs.level === 2 ? 'heading' : parent.attrs.level === 3 ? 'subheading' : 'other'
  return 'other'
}

function nearest(state: EditorState, types: NodeType[]): { node: DocNode; pos: number } | null {
  const { $from } = state.selection
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth)
    if (types.includes(node.type)) return { node, pos: $from.before(depth) }
  }
  return null
}

function activeOf(state: EditorState): Active {
  const list = nearest(state, [nodes.bullet_list, nodes.ordered_list])
  return {
    block: blockOf(state),
    bold: markActive(state, marks.strong),
    italic: markActive(state, marks.em),
    link: markActive(state, marks.link),
    quote: Boolean(nearest(state, [nodes.blockquote])),
    list: list ? (list.node.type === nodes.bullet_list ? 'bullet' : 'ordered') : null,
  }
}

// The stretch of text around a position that carries the same link.
function linkRange(state: EditorState, pos: number): { from: number; to: number } | null {
  const $pos = state.doc.resolve(pos)
  const runs: { from: number; to: number; href: string | null }[] = []
  let at = $pos.start()
  $pos.parent.forEach((child) => {
    const link = marks.link.isInSet(child.marks)
    runs.push({ from: at, to: at + child.nodeSize, href: link ? (link.attrs.href as string) : null })
    at += child.nodeSize
  })
  const i = runs.findIndex((run) => run.href && run.from <= pos && pos <= run.to)
  if (i < 0) return null
  let a = i
  let b = i
  while (a > 0 && runs[a - 1].href === runs[i].href) a--
  while (b < runs.length - 1 && runs[b + 1].href === runs[i].href) b++
  return { from: runs[a].from, to: runs[b].to }
}

/* Commands ------------------------------------------------------------------------------------------------ */

const setText: Command = setBlockType(nodes.paragraph)

function setHeading(level: 2 | 3): Command {
  return (state, dispatch) => {
    const current = blockOf(state)
    if ((level === 2 && current === 'heading') || (level === 3 && current === 'subheading')) return setText(state, dispatch)
    return setBlockType(nodes.heading, { level })(state, dispatch)
  }
}

const toggleQuote: Command = (state, dispatch) =>
  nearest(state, [nodes.blockquote]) ? lift(state, dispatch) : wrapIn(nodes.blockquote)(state, dispatch)

function toggleList(type: NodeType): Command {
  return (state, dispatch) => {
    const current = nearest(state, [nodes.bullet_list, nodes.ordered_list])
    if (current?.node.type === type) return liftListItem(nodes.list_item)(state, dispatch)
    if (current) {
      // A bulleted list becomes a numbered one, or the other way round.
      if (dispatch) dispatch(state.tr.setNodeMarkup(current.pos, type, type === nodes.ordered_list ? { order: 1, tight: true } : { tight: true }))
      return true
    }
    return wrapInList(type)(state, dispatch)
  }
}

// Puts whole blocks (a divider, a picture) after the line being written, or in place of it if it's empty,
// with an empty line after them to carry on writing.
function insertBlocks(blocks: DocNode[]): Command {
  return (state, dispatch) => {
    const { $from } = state.selection
    const textblock = $from.parent
    if (!textblock.isTextblock) return false
    if (dispatch) {
      const empty = textblock.content.size === 0
      const from = empty ? $from.before() : $from.after()
      const to = empty ? $from.after() : $from.after()
      const nextIsText = !empty && state.doc.resolve(to).nodeAfter?.isTextblock
      const content = nextIsText ? blocks : [...blocks, nodes.paragraph.create()]
      const tr = state.tr.replaceWith(from, to, Fragment.from(content))
      const after = from + blocks.reduce((size, node) => size + node.nodeSize, 0)
      tr.setSelection(TextSelection.near(tr.doc.resolve(after + 1)))
      dispatch(tr.scrollIntoView())
    }
    return true
  }
}

const hardBreak: Command = chainCommands(exitCode, (state, dispatch) => {
  if (dispatch) dispatch(state.tr.replaceSelectionWith(nodes.hard_break.create()).scrollIntoView())
  return true
})

// Backspace at the start of a heading turns it back into ordinary text.
const headingToText: Command = (state, dispatch) => {
  const { $from, empty } = state.selection
  if (!empty || $from.parentOffset !== 0 || $from.parent.type !== nodes.heading) return false
  return setText(state, dispatch)
}

/* Typing shortcuts: ## heading, ### subheading, > quote, - list, 1. list, --- divider, **bold**, *italic* ----- */

// `size` is how many marker characters wrap the words (2 for **bold**, 1 for *italic*). The match may start
// with the character before the opening marker, which stays where it is.
function markRule(pattern: RegExp, type: MarkType, size: number): InputRule {
  return new InputRule(pattern, (state, match, start, end) => {
    const [full, inner] = match
    const textStart = start + full.length - size - inner.length
    const markStart = textStart - size
    const tr = state.tr
    tr.delete(textStart + inner.length, end)
    tr.delete(markStart, textStart)
    tr.addMark(markStart, markStart + inner.length, type.create())
    tr.removeStoredMark(type)
    return tr
  })
}

const typingRules = inputRules({
  rules: [
    textblockTypeInputRule(/^(#{1,3})\s$/, nodes.heading, (match) => ({ level: match[1].length === 3 ? 3 : 2 })),
    wrappingInputRule(/^\s*>\s$/, nodes.blockquote),
    wrappingInputRule(/^\s*([-+*])\s$/, nodes.bullet_list),
    wrappingInputRule(
      /^(\d+)\.\s$/,
      nodes.ordered_list,
      (match) => ({ order: Number(match[1]) || 1 }),
      (match, node) => node.childCount + (node.attrs.order as number) === Number(match[1]),
    ),
    new InputRule(/^(?:---|\*\*\*|___)$/, (state, _match, start) => {
      const $start = state.doc.resolve(start)
      if ($start.parent.type !== nodes.paragraph) return null
      const from = $start.before()
      const to = $start.after()
      const tr = state.tr.replaceWith(from, to, Fragment.from([nodes.horizontal_rule.create(), nodes.paragraph.create()]))
      return tr.setSelection(TextSelection.near(tr.doc.resolve(from + 2)))
    }),
    markRule(/\*\*([^*\s](?:[^*]*[^*\s])?)\*\*$/, marks.strong, 2),
    markRule(/(?:^|[^*\w])\*([^*\s](?:[^*]*[^*\s])?)\*$/, marks.em, 1),
  ],
})

/* Hints in the text: the placeholder, and how to make a heading on the empty line being written ---------------- */

const EMPTY_HINT = 'Start writing. Type ## and a space for a heading, or ### for a subheading.'
const LINE_HINT = 'Type ## and a space for a heading, ### for a subheading'

const hints = new Plugin({
  props: {
    decorations(state) {
      const { doc, selection } = state
      const first = doc.firstChild
      if (doc.childCount === 1 && first?.type === nodes.paragraph && first.content.size === 0) {
        return DecorationSet.create(doc, [Decoration.node(0, first.nodeSize, { class: 'is-empty is-placeholder', 'data-hint': EMPTY_HINT })])
      }
      const { $from, empty } = selection
      const parent = $from.parent
      if ($from.depth < 1) return null
      const found: Decoration[] = []
      // The heading the cursor is in has its label filled in.
      if (parent.type === nodes.heading) found.push(Decoration.node($from.before(), $from.after(), { class: 'is-here' }))
      if (empty && parent.content.size === 0) {
        const hint =
          parent.type === nodes.heading
            ? parent.attrs.level === 3
              ? 'Subheading'
              : 'Heading'
            : parent.type === nodes.paragraph && $from.depth === 1
              ? LINE_HINT
              : null
        if (hint) found.push(Decoration.node($from.before(), $from.after(), { class: 'is-empty is-current', 'data-hint': hint }))
      }
      return found.length ? DecorationSet.create(doc, found) : null
    },
  },
})

/* The editor ------------------------------------------------------------------------------------------------ */

export default function ArticleBodyEditor({ value, onChange, uploadImage, onError }: Props) {
  const labelId = useId()
  const [mode, setMode] = useState<'write' | 'preview'>('write')
  const [broken, setBroken] = useState<string | null>(null)
  const [active, setActive] = useState<Active>(NONE)
  const [bubble, setBubble] = useState<Bubble | null>(null)
  const [linking, setLinking] = useState(false)
  const [uploading, setUploading] = useState(false)

  const host = useRef<HTMLDivElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const emitted = useRef<string>(value)
  const pointerDown = useRef(false)
  // The words a link is being added to, while the address is typed.
  const linkDraft = useRef<{ from: number; to: number } | null>(null)
  const latest = useRef({ onChange, onError })
  latest.current = { onChange, onError }

  // Where the small bar over selected words goes.
  const placeBubble = useCallback(() => {
    const v = view.current
    const box = wrap.current
    if (!v || !box) return setBubble(null)
    const { selection } = v.state
    const touch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
    if (selection.empty || !(selection instanceof TextSelection) || !v.hasFocus() || pointerDown.current || touch) return setBubble(null)
    const start = v.coordsAtPos(selection.from)
    const end = v.coordsAtPos(selection.to)
    const outer = box.getBoundingClientRect()
    const sameLine = Math.abs(start.top - end.top) < 4
    const left = (sameLine ? (start.left + end.right) / 2 : start.left + 60) - outer.left
    const below = start.top - outer.top < 70
    setBubble({ left: Math.max(BUBBLE_HALF, Math.min(outer.width - BUBBLE_HALF, left)), top: below ? end.bottom - outer.top + 10 : start.top - outer.top - 10, below })
  }, [])

  const refresh = useCallback(() => {
    const v = view.current
    if (!v) return
    setActive(activeOf(v.state))
    placeBubble()
  }, [placeBubble])

  const run = useCallback(
    (command: Command) => {
      const v = view.current
      if (!v) return
      command(v.state, v.dispatch, v)
      v.focus()
      refresh()
    },
    [refresh],
  )

  // Links: with words selected, the bar asks for the address; on a link, it takes the link off.
  const startLink = useCallback(() => {
    const v = view.current
    if (!v) return
    const { state } = v
    if (markActive(state, marks.link)) {
      const { from, to, empty } = state.selection
      const range = empty ? linkRange(state, from) : { from, to }
      if (range) v.dispatch(state.tr.removeMark(range.from, range.to, marks.link))
      v.focus()
      refresh()
      return
    }
    const { from, to } = state.selection
    linkDraft.current = { from, to }
    setLinking(true)
    if (from === to) {
      // Nothing selected: the bar opens where the cursor is, and the address itself becomes the link.
      const at = v.coordsAtPos(from)
      const outer = wrap.current?.getBoundingClientRect()
      if (outer) setBubble({ left: Math.max(BUBBLE_HALF, Math.min(outer.width - BUBBLE_HALF, at.left - outer.left)), top: at.top - outer.top - 10, below: false })
    }
  }, [refresh])

  const finishLink = useCallback(
    (raw: string | null) => {
      const v = view.current
      const draft = linkDraft.current
      linkDraft.current = null
      setLinking(false)
      if (!v || !draft) return
      const text = (raw ?? '').trim()
      if (text) {
        const href = /^(https?:|mailto:|tel:|\/|#)/i.test(text) ? text : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? `mailto:${text}` : `https://${text}`
        const tr = v.state.tr
        if (draft.from === draft.to) {
          tr.insertText(text, draft.from)
          tr.addMark(draft.from, draft.from + text.length, marks.link.create({ href }))
        } else {
          tr.addMark(draft.from, draft.to, marks.link.create({ href }))
        }
        v.dispatch(tr)
      }
      v.focus()
      refresh()
    },
    [refresh],
  )

  // The editor itself, made once the box is on the page.
  useEffect(() => {
    if (mode !== 'write' || broken || !host.current) return
    let doc: DocNode
    try {
      doc = parseArticle(emitted.current)
    } catch (err) {
      setBroken(err instanceof Error ? err.message : 'unknown')
      return
    }
    const state = EditorState.create({
      doc,
      plugins: [
        typingRules,
        keymap({
          'Mod-z': undo,
          'Shift-Mod-z': redo,
          'Mod-y': redo,
          'Mod-b': toggleMark(marks.strong),
          'Mod-i': toggleMark(marks.em),
          'Mod-k': () => {
            startLink()
            return true
          },
          'Mod-Alt-0': setText,
          'Mod-Alt-2': setHeading(2),
          'Mod-Alt-3': setHeading(3),
          'Shift-Enter': hardBreak,
          Enter: splitListItem(nodes.list_item),
          Tab: sinkListItem(nodes.list_item),
          'Shift-Tab': liftListItem(nodes.list_item),
          Backspace: chainCommands(undoInputRule, headingToText),
        }),
        keymap(baseKeymap),
        history(),
        hints,
      ],
    })
    const v = new EditorView(host.current, {
      state,
      attributes: {
        class: 'prose rich-text',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-labelledby': labelId,
        spellcheck: 'true',
      },
      dispatchTransaction(tr) {
        const next = v.state.apply(tr)
        v.updateState(next)
        if (tr.docChanged) {
          const text = serializeArticle(next.doc)
          emitted.current = text
          latest.current.onChange(text)
        }
        setActive(activeOf(next))
        placeBubble()
      },
      // Text pasted from Google Docs, Word or a web page goes through the same tidy-up as before,
      // so it keeps its headings, bold, italic, links and lists and nothing else.
      handlePaste(editor, event) {
        const data = event.clipboardData
        if (!data || data.getData('text/html').includes('data-pm-slice')) return false
        const text = pastedText(data)
        if (!text) return false
        let pasted: DocNode
        try {
          pasted = parseArticle(text)
        } catch {
          return false
        }
        const slice = new Slice(pasted.content, 1, 1)
        const single = pasted.childCount === 1 && pasted.firstChild?.type === nodes.paragraph
        editor.dispatch(editor.state.tr.replaceSelection(single ? slice : Slice.maxOpen(pasted.content)).scrollIntoView())
        return true
      },
      handleDOMEvents: {
        focus: () => {
          setTimeout(refresh)
          return false
        },
        blur: () => {
          setTimeout(() => {
            if (!wrap.current?.contains(document.activeElement)) setBubble(null)
          })
          return false
        },
        pointerdown: () => {
          pointerDown.current = true
          linkDraft.current = null
          setLinking(false)
          setBubble(null)
          return false
        },
      },
    })
    view.current = v
    setActive(activeOf(v.state))
    const up = () => {
      if (!pointerDown.current) return
      pointerDown.current = false
      setTimeout(placeBubble)
    }
    window.addEventListener('pointerup', up)
    window.addEventListener('resize', placeBubble)
    return () => {
      window.removeEventListener('pointerup', up)
      window.removeEventListener('resize', placeBubble)
      v.destroy()
      view.current = null
    }
    // The editor is made once per visit to Write; it reads the latest text from `emitted`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, broken])

  // Text changed from outside (not typed here): show it.
  useEffect(() => {
    const v = view.current
    if (!v || value === emitted.current) return
    emitted.current = value
    try {
      v.updateState(EditorState.create({ doc: parseArticle(value), plugins: v.state.plugins }))
      setActive(activeOf(v.state))
    } catch (err) {
      setBroken(err instanceof Error ? err.message : 'unknown')
    }
  }, [value])

  async function onImage(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const src = await uploadImage(file)
      const picture = nodes.paragraph.create(null, nodes.image.create({ src, alt: altFromName(file.name) }))
      run(insertBlocks([picture]))
    } catch (err) {
      latest.current.onError(err instanceof Error ? `Image upload failed: ${err.message}` : 'Image upload failed.')
    } finally {
      setUploading(false)
      input.value = ''
    }
  }

  // The plain text box takes over for text the visual editor can't show.
  if (broken) {
    return (
      <div className="body-editor">
        <p className="notice" role="status" style={{ marginBottom: 12 }}>
          This article has formatting the visual editor can’t show (a table, say), so it’s open as plain text. Headings start with ## here.
        </p>
        <BodyEditor value={value} onChange={onChange} uploadImage={uploadImage} onError={onError} />
      </div>
    )
  }

  const keep = (event: { preventDefault: () => void }) => event.preventDefault()
  const styles: { block: Block; label: string; title: string; command: Command }[] = [
    { block: 'text', label: 'Text', title: 'Ordinary text (Ctrl or ⌘ + Alt + 0)', command: setText },
    { block: 'heading', label: 'Heading', title: 'Heading: type ## and a space, or Ctrl or ⌘ + Alt + 2', command: setHeading(2) },
    { block: 'subheading', label: 'Subheading', title: 'Subheading: type ### and a space, or Ctrl or ⌘ + Alt + 3', command: setHeading(3) },
  ]

  return (
    <div className="body-editor">
      <div className="body-head">
        <span id={labelId} className="field-label">
          Article
        </span>
        <div className="body-tabs" role="tablist" aria-label="Write or preview">
          <button type="button" role="tab" aria-selected={mode === 'write'} onClick={() => setMode('write')}>
            Write
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'preview'}
            onClick={() => {
              setBubble(null)
              linkDraft.current = null
              setLinking(false)
              setMode('preview')
            }}
          >
            Preview
          </button>
        </div>
      </div>

      {mode === 'write' ? (
        <div className="rich" ref={wrap}>
          <div className="body-tools rich-tools" role="toolbar" aria-label="Formatting">
            <div className="rich-styles" role="group" aria-label="Kind of line">
              {styles.map((style) => (
                <button
                  key={style.block}
                  type="button"
                  className={`rich-style rich-style-${style.block}`}
                  title={style.title}
                  aria-pressed={active.block === style.block}
                  onMouseDown={keep}
                  onClick={() => run(style.command)}
                >
                  {style.label}
                </button>
              ))}
            </div>
            <span className="rich-sep" aria-hidden="true" />
            <button type="button" className="body-tool tool-bold" title="Bold (Ctrl or ⌘ + B)" aria-label="Bold" aria-pressed={active.bold} onMouseDown={keep} onClick={() => run(toggleMark(marks.strong))}>
              B
            </button>
            <button type="button" className="body-tool tool-italic" title="Italic (Ctrl or ⌘ + I)" aria-label="Italic" aria-pressed={active.italic} onMouseDown={keep} onClick={() => run(toggleMark(marks.em))}>
              I
            </button>
            <button type="button" className="body-tool" title="Link (Ctrl or ⌘ + K)" aria-pressed={active.link} onMouseDown={keep} onClick={startLink}>
              Link
            </button>
            <span className="rich-sep" aria-hidden="true" />
            <button type="button" className="body-tool" title="Quote (type > and a space)" aria-pressed={active.quote} onMouseDown={keep} onClick={() => run(toggleQuote)}>
              Quote
            </button>
            <button type="button" className="body-tool" title="Bulleted list (type - and a space)" aria-pressed={active.list === 'bullet'} onMouseDown={keep} onClick={() => run(toggleList(nodes.bullet_list))}>
              List
            </button>
            <button type="button" className="body-tool" title="Numbered list (type 1. and a space)" aria-pressed={active.list === 'ordered'} onMouseDown={keep} onClick={() => run(toggleList(nodes.ordered_list))}>
              1. List
            </button>
            <button type="button" className="body-tool" title="A dividing line (type ---)" onMouseDown={keep} onClick={() => run(insertBlocks([nodes.horizontal_rule.create()]))}>
              Divider
            </button>
            <label className="body-tool body-tool-image" title="Add a picture" style={{ cursor: uploading ? 'progress' : 'pointer' }}>
              {uploading ? 'Uploading…' : 'Picture'}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={onImage} disabled={uploading} hidden />
            </label>
          </div>

          <div className="rich-page">
            <div ref={host} className="rich-host" />
          </div>

          {bubble && (
            <div
              className={`rich-bubble${bubble.below ? ' is-below' : ''}`}
              style={{ left: bubble.left, top: bubble.top }}
              role="toolbar"
              aria-label="Format the selected words"
              onMouseDown={(event) => {
                if (!(event.target instanceof HTMLInputElement)) event.preventDefault()
              }}
            >
              {linking ? (
                <LinkField onDone={finishLink} />
              ) : (
                <>
                  <button type="button" className="tool-bold" aria-label="Bold" aria-pressed={active.bold} onClick={() => run(toggleMark(marks.strong))}>
                    B
                  </button>
                  <button type="button" className="tool-italic" aria-label="Italic" aria-pressed={active.italic} onClick={() => run(toggleMark(marks.em))}>
                    I
                  </button>
                  <button type="button" aria-pressed={active.link} onClick={startLink}>
                    {active.link ? 'Unlink' : 'Link'}
                  </button>
                  <span className="rich-bubble-sep" aria-hidden="true" />
                  <button type="button" className="bubble-heading" title="Heading" aria-pressed={active.block === 'heading'} onClick={() => run(setHeading(2))}>
                    Heading
                  </button>
                  <button type="button" className="bubble-subheading" title="Subheading" aria-pressed={active.block === 'subheading'} onClick={() => run(setHeading(3))}>
                    Subheading
                  </button>
                  <button type="button" aria-pressed={active.quote} onClick={() => run(toggleQuote)}>
                    Quote
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="body-preview" aria-live="polite">
          {!value.trim() ? <p className="hint">Nothing written yet.</p> : <Prose source={value} />}
        </div>
      )}
    </div>
  )
}

// The address box in the small bar: Enter adds the link; Escape, or clicking elsewhere, closes it.
function LinkField({ onDone }: { onDone: (href: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => input.current?.focus(), [])
  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      onDone(event.currentTarget.value)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onDone(null)
    }
  }
  return (
    <span className="rich-link">
      <input ref={input} type="url" inputMode="url" placeholder="Paste or type a link, then press Enter" aria-label="Link address" onKeyDown={onKeyDown} onBlur={() => onDone(null)} />
    </span>
  )
}
