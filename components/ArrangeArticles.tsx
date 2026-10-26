'use client'

import { Fragment, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { saveArticleOrder } from '@/app/admin/actions'

export type ArrangeItem = {
  id: string
  title: string
  // The date line under the title.
  meta: string
  // False while an article is scheduled and not on the site yet.
  live: boolean
  // Published since the order was last saved, so it's sitting at the top for now.
  unplaced: boolean
  thumb: ReactNode
}

// The home page shows one article large, then this many in the grid below it (see app/page.tsx).
const HOME_GRID = 12

function moved<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return list
  const next = list.slice()
  const [item] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(next.length, to)), 0, item)
  return next
}

function Grip() {
  return (
    <svg width="12" height="18" viewBox="0 0 12 18" aria-hidden="true" focusable="false">
      {[3, 9].map((x) => [3, 9, 15].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" fill="currentColor" />))}
    </svg>
  )
}

function Chevron({ up }: { up?: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      <path d={up ? 'M2.5 9 7 4.5 11.5 9' : 'M2.5 5 7 9.5 11.5 5'} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Drag rows by the dotted handle (mouse or touch), use the arrows on each row, or focus a handle and press the arrow keys.
export default function ArrangeArticles({ items, featuredId }: { items: ArrangeItem[]; featuredId: string | null }) {
  const [order, setOrder] = useState(items)
  const [dragging, setDragging] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const listRef = useRef<HTMLOListElement>(null)
  const handles = useRef(new Map<string, HTMLButtonElement>())
  const focusNext = useRef<string | null>(null)
  const orderRef = useRef(order)
  orderRef.current = order

  // After a save the page reloads with the stored order, which becomes the starting point again.
  useEffect(() => {
    setOrder(items)
    setSaving(false)
  }, [items])

  const ids = order.map((item) => item.id).join(',')
  const dirty = ids !== items.map((item) => item.id).join(',')

  useEffect(() => {
    if (!focusNext.current) return
    handles.current.get(focusNext.current)?.focus()
    focusNext.current = null
  }, [order])

  // Leaving with unsaved changes asks first.
  useEffect(() => {
    if (!dirty || saving) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, saving])

  const say = (list: ArrangeItem[], id: string) => {
    const at = list.findIndex((item) => item.id === id)
    if (at >= 0) setAnnouncement(`${list[at].title}: position ${at + 1} of ${list.length}.`)
  }

  function moveTo(id: string, to: number, keepFocus = false) {
    const from = order.findIndex((item) => item.id === id)
    const target = Math.max(0, Math.min(order.length - 1, to))
    if (from < 0 || from === target) return
    const next = moved(order, from, target)
    setOrder(next)
    say(next, id)
    if (keepFocus) focusNext.current = id
  }

  function onHandleKey(event: KeyboardEvent<HTMLButtonElement>, id: string, index: number) {
    const to =
      event.key === 'ArrowUp' ? index - 1 : event.key === 'ArrowDown' ? index + 1 : event.key === 'Home' ? 0 : event.key === 'End' ? order.length - 1 : null
    if (to === null) return
    event.preventDefault()
    moveTo(id, to, true)
  }

  function startDrag(event: ReactPointerEvent<HTMLButtonElement>, id: string) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.preventDefault()
    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)
    setDragging(id)

    const onMove = (ev: PointerEvent) => {
      const list = listRef.current
      if (!list) return
      // The row goes below every other row whose middle is above the pointer.
      let to = 0
      for (const row of Array.from(list.querySelectorAll<HTMLElement>('[data-id]'))) {
        if (row.dataset.id === id) continue
        const box = row.getBoundingClientRect()
        if (ev.clientY > box.top + box.height / 2) to++
      }
      setOrder((prev) => {
        const from = prev.findIndex((item) => item.id === id)
        return from === to ? prev : moved(prev, from, to)
      })
      // Near the top or bottom of the screen, the page scrolls along.
      const edge = 72
      if (ev.clientY < edge) window.scrollBy(0, -14)
      else if (ev.clientY > window.innerHeight - edge) window.scrollBy(0, 14)
    }
    const onEnd = () => {
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onEnd)
      handle.removeEventListener('pointercancel', onEnd)
      setDragging(null)
      say(orderRef.current, id)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onEnd)
    handle.addEventListener('pointercancel', onEnd)
  }

  // Which articles the home page shows: the featured one large (or the first, if none is featured), then the next twelve.
  const live = order.filter((item) => item.live).map((item) => item.id)
  const large = featuredId && live.includes(featuredId) ? featuredId : (live[0] ?? null)
  const grid = live.filter((id) => id !== large).slice(0, HOME_GRID)
  const lastOnHome = grid.length === HOME_GRID ? grid[HOME_GRID - 1] : null

  return (
    <div className="arrange">
      <ol className="arrange-list" ref={listRef}>
        {order.map((item, index) => {
          const tags = [
            item.id === large ? (item.id === featuredId ? 'Featured, large on the home page' : 'Large on the home page') : null,
            item.live ? null : 'Scheduled',
            item.unplaced ? 'New, at the top until you move it' : null,
          ].filter(Boolean)
          return (
            <Fragment key={item.id}>
            <li data-id={item.id} className={`arrange-row${dragging === item.id ? ' is-dragging' : ''}`}>
              <button
                type="button"
                className="arrange-handle"
                ref={(el) => {
                  if (el) handles.current.set(item.id, el)
                  else handles.current.delete(item.id)
                }}
                aria-label={`Move “${item.title}”, position ${index + 1} of ${order.length}`}
                aria-describedby="arrange-help"
                onPointerDown={(event) => startDrag(event, item.id)}
                onKeyDown={(event) => onHandleKey(event, item.id, index)}
              >
                <Grip />
              </button>
              <span className="arrange-num" aria-hidden="true">
                {index + 1}
              </span>
              <span className="arrange-thumb">{item.thumb}</span>
              <span className="arrange-text">
                <span className="arrange-title">{item.title}</span>
                <span className="arrange-meta">
                  {item.meta}
                  {tags.map((tag) => (
                    <span key={tag} className="badge">
                      {tag}
                    </span>
                  ))}
                </span>
              </span>
              <span className="arrange-moves">
                <button type="button" className="arrange-move" aria-label={`Move “${item.title}” up`} disabled={index === 0} onClick={() => moveTo(item.id, index - 1)}>
                  <Chevron up />
                </button>
                <button
                  type="button"
                  className="arrange-move"
                  aria-label={`Move “${item.title}” down`}
                  disabled={index === order.length - 1}
                  onClick={() => moveTo(item.id, index + 1)}
                >
                  <Chevron />
                </button>
              </span>
            </li>
            {item.id === lastOnHome && index < order.length - 1 && (
              <li className="arrange-fold" aria-hidden="true">
                The home page shows the articles above this line
              </li>
            )}
            </Fragment>
          )
        })}
      </ol>

      <p id="arrange-help" className="sr-only">
        Press the up and down arrow keys to move this article, Home to move it to the top, End to the bottom.
      </p>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <div className={`arrange-bar${dirty ? ' is-dirty' : ''}`}>
        <p className="arrange-status">{dirty ? 'Order changed. Save to update the site.' : 'This is the order on the site.'}</p>
        <div className="arrange-actions">
          <button type="button" className="btn btn-secondary" disabled={!dirty || saving} onClick={() => setOrder(items)}>
            Undo changes
          </button>
          <form action={saveArticleOrder} onSubmit={() => setSaving(true)}>
            <input type="hidden" name="order" value={ids} />
            <button type="submit" className="btn" disabled={!dirty || saving}>
              {saving ? 'Saving…' : 'Save order'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
