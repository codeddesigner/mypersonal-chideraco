'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

// A small bar pinned to the bottom of the screen, inviting readers to the tiny games (app/play).
// It slides in shortly after a page opens, slides away while the reader scrolls down the page, and comes back
// when they scroll back to the top. The cross (or Play) puts it away while they move around the site;
// nothing is stored, so it's back whenever the site is opened again (or reloaded).
const DELAY_MS = 1200
const SCROLLED = 24
const SLIDE_MS = 400

// The game itself, pages about signing up, unsubscribing or signing in, and the admin area.
const SKIP = ['/play', '/subscribe', '/unsubscribe', '/login', '/signup', '/account', '/forgot-password', '/reset-password', '/verify', '/admin', '/auth']

export default function GameNudge() {
  const pathname = usePathname() ?? '/'
  // 'off': not on the page. 'away': on the page but slid out of view. 'shown': in view.
  const [phase, setPhase] = useState<'off' | 'away' | 'shown'>('off')
  const ready = useRef(false) // the short wait after arriving is over
  const closed = useRef(false)
  const offTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (closed.current || SKIP.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
      setPhase('off')
      return
    }
    // In view only at the top of the page; anywhere further down it waits out of view.
    const update = () => {
      if (closed.current) return
      setPhase(ready.current && window.scrollY <= SCROLLED ? 'shown' : 'away')
    }
    update()
    const timer = ready.current
      ? undefined
      : window.setTimeout(() => {
          ready.current = true
          update()
        }, DELAY_MS)
    window.addEventListener('scroll', update, { passive: true })
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('scroll', update)
    }
  }, [pathname])

  useEffect(() => () => window.clearTimeout(offTimer.current), [])

  // The cross or Play: slide away and stay away while the reader moves around the site.
  const close = () => {
    closed.current = true
    setPhase('away')
    window.clearTimeout(offTimer.current)
    offTimer.current = window.setTimeout(() => setPhase('off'), SLIDE_MS)
  }

  if (phase === 'off') return null
  const away = phase === 'away'
  return (
    <aside
      className={`game-nudge${away ? ' is-away' : ''}`}
      data-accent="pool"
      aria-label="Tiny games"
      aria-hidden={away || undefined}
      inert={away}
    >
      <svg className="game-nudge-ball" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <circle cx="24" cy="24" r="21" fill="#EE7A2F" stroke="currentColor" strokeWidth="2.5" />
        <path
          d="M3.5 24h41M24 3.5v41M11 8.5c5 4 8 9.5 8 15.5s-3 11.5-8 15.5M37 8.5c-5 4-8 9.5-8 15.5s3 11.5 8 15.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
      <p className="game-nudge-text">
        <strong>Got a minute?</strong> Play a tiny game.
      </p>
      <Link href="/play" className="btn game-nudge-play" onClick={close}>
        Play
      </Link>
      <button type="button" className="game-nudge-close" onClick={close} aria-label="Close">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
          <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </aside>
  )
}
