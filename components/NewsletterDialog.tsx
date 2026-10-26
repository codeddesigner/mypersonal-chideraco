'use client'

import { usePathname } from 'next/navigation'
import { Fragment, useEffect, useId, useRef } from 'react'
import NewsletterForm from './NewsletterForm'

// The sign-up pop-up. It opens a few seconds after someone arrives, at most once a visit.
// "Maybe later" (or the cross, Esc, or a tap outside) keeps it away for a week on that device;
// signing up keeps it away for good.
const KEY = 'chidera-newsletter-popup'
const DELAY_MS = 3000
const REST_MS = 7 * 24 * 60 * 60 * 1000

// Pages that are already about signing up, unsubscribing or signing in, the game itself, and the admin area.
const SKIP = ['/subscribe', '/unsubscribe', '/login', '/signup', '/account', '/forgot-password', '/reset-password', '/verify', '/play', '/admin', '/auth']

function remembered(): string | null {
  try {
    return window.localStorage.getItem(KEY)
  } catch {
    return null
  }
}

function remember(value: string) {
  try {
    window.localStorage.setItem(KEY, value)
  } catch {
    // Storage can be blocked (private windows); the pop-up then just shows once per visit.
  }
}

function isDue() {
  const value = remembered()
  if (!value) return true
  if (value === 'joined') return false
  const closedAt = Number(value)
  return !Number.isFinite(closedAt) || Date.now() - closedAt > REST_MS
}

export default function NewsletterDialog({ heading, note }: { heading: string[]; note?: string }) {
  const pathname = usePathname() ?? '/'
  const titleId = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const opened = useRef(false)
  const joined = useRef(false)

  useEffect(() => {
    if (opened.current) return
    if (SKIP.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return
    if (!isDue()) return
    const timer = window.setTimeout(() => {
      const box = dialog.current
      if (!box || box.open || typeof box.showModal !== 'function') return
      // Don't cut in on someone typing into a form (a comment, the search box).
      if (document.activeElement?.matches('input, textarea, select, [contenteditable="true"]')) return
      opened.current = true
      box.showModal()
      // Focus the box itself rather than the cross, so it's announced as a whole and no focus ring flashes up.
      box.focus()
    }, DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [pathname])

  const close = () => dialog.current?.close()

  return (
    <dialog
      ref={dialog}
      className="nl-pop"
      tabIndex={-1}
      data-accent="lemon"
      aria-labelledby={titleId}
      // Every way of closing it lands here, so it's remembered in one place.
      onClose={() => remember(joined.current ? 'joined' : String(Date.now()))}
      // A tap on the dimmed page around the box closes it.
      onClick={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <div className="nl-pop-inner">
        <button type="button" className="nl-pop-close" onClick={close} aria-label="Close">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
            <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <h2 id={titleId} className="newsletter-line nl-pop-title">
          {heading.map((line, i) => (
            <Fragment key={i}>
              {i > 0 && <br />}
              {line}
            </Fragment>
          ))}
        </h2>
        <NewsletterForm
          source="popup"
          note={note}
          onDone={() => {
            joined.current = true
            remember('joined')
          }}
        />
        <button type="button" className="link-btn nl-pop-later" onClick={close}>
          Maybe later
        </button>
      </div>
    </dialog>
  )
}
