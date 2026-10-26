'use client'

import { useEffect, useRef } from 'react'

// Sections that rise into view as the reader scrolls. CSS decides what each one does
// (globals.css, "Motion"); this only marks them with data-in when they arrive.
const REVEAL =
  '.feature, .statement, .section-head, .card, .newsletter, .footer-main > *, .topic-index li, .adjacent-link, ' +
  '.about-section-title, .timeline > li, .services > li, .hobbies > li, .clients, .about-text, .about-section .links, .stop'
// Reading pages too: an article block by block, then its comments, the subscription prompt, account sections
// and empty states (styles in app/reveal.css). Not in the admin, where things should stay put.
const READING =
  '.article-body .prose > *, .gate, .comments-title, .comment-list > li, .comments-empty, .comments-signin, .comment-form, ' +
  '.page .block, .empty'

// sink: moves with the page scroll at a fraction of its speed (the hero portrait).
// drift: slides between -amount and +amount while its frame crosses the screen.
type Layer = { el: HTMLElement; frame: HTMLElement; kind: 'sink' | 'drift'; amount: number }

export default function Motion() {
  const bar = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-motion-ready', '')
    // Set before first paint by the script in the layout, unless the reader prefers reduced motion.
    const moving = root.hasAttribute('data-motion')
    const watched = new WeakSet<Element>()
    // Watched but not yet shown.
    const pending = new Set<HTMLElement>()
    let layers: Layer[] = []
    let queued = false
    let scanQueued = false

    const io = moving
      ? new IntersectionObserver(
          (entries) => {
            let n = 0
            for (const entry of entries) {
              if (!entry.isIntersecting) continue
              reveal(entry.target as HTMLElement, n)
              n += 1
            }
          },
          { rootMargin: '0px 0px -6% 0px' },
        )
      : null

    // n staggers things that arrive together, so they come in one after another.
    // Article text follows more closely, so a fast reader isn't left looking at a gap.
    function reveal(el: HTMLElement, n: number) {
      const text = el.parentElement?.classList.contains('prose')
      el.style.setProperty('--d', `${text ? Math.min(n, 4) * 50 : Math.min(n, 5) * 90}ms`)
      el.querySelectorAll<HTMLElement>('.st').forEach((topic, i) => topic.style.setProperty('--n', String(i)))
      el.setAttribute('data-in', '')
      io?.unobserve(el)
      pending.delete(el)
    }

    function collectLayers() {
      layers.forEach((layer) => layer.el.style.removeProperty('--py'))
      layers = []
      if (!moving) return
      const hero = document.querySelector<HTMLElement>('.hero')
      const portrait = hero?.querySelector<HTMLElement>('.hero-portrait')
      if (hero && portrait) layers.push({ el: portrait, frame: hero, kind: 'sink', amount: 0.22 })
      document.querySelectorAll<HTMLElement>('.feature-cover .cover').forEach((frame) => {
        const inner = frame.firstElementChild as HTMLElement | null
        if (inner) layers.push({ el: inner, frame, kind: 'drift', amount: -0.06 * frame.offsetHeight })
      })
    }

    function scan() {
      scanQueued = false
      if (io) {
        const watch = (el: Element) => {
          if (watched.has(el) || el.hasAttribute('data-in')) return
          watched.add(el)
          pending.add(el as HTMLElement)
          io.observe(el)
        }
        document.querySelectorAll(REVEAL).forEach(watch)
        document.querySelectorAll(READING).forEach((el) => {
          if (!el.closest('.admin')) watch(el)
        })
      }
      collectLayers()
      paint()
    }

    function paint() {
      queued = false
      const vh = window.innerHeight
      const y = window.scrollY
      const max = document.documentElement.scrollHeight - vh
      if (bar.current) bar.current.style.transform = `scaleX(${max > 0 ? Math.min(1, Math.max(0, y / max)) : 0})`
      // A fast scroll or a jump (the End key, a link to a heading) can carry things past the screen without
      // them ever being on it. Show those straight away, so nothing is left hidden above.
      if (pending.size) {
        const passed: HTMLElement[] = []
        pending.forEach((el) => {
          if (!el.isConnected) pending.delete(el)
          else if (el.getBoundingClientRect().bottom < 0) passed.push(el)
        })
        passed.forEach((el) => reveal(el, 0))
      }
      for (const layer of layers) {
        const r = layer.frame.getBoundingClientRect()
        if (r.bottom < -120 || r.top > vh + 120) continue
        let offset: number
        if (layer.kind === 'sink') {
          offset = Math.max(0, y) * layer.amount
        } else {
          const p = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2)
          offset = Math.max(-1, Math.min(1, p)) * layer.amount
        }
        layer.el.style.setProperty('--py', `${offset.toFixed(1)}px`)
      }
    }

    const onScroll = () => {
      if (queued) return
      queued = true
      requestAnimationFrame(paint)
    }
    const onChange = () => {
      if (scanQueued) return
      scanQueued = true
      requestAnimationFrame(scan)
    }

    // New pages and late content arrive as DOM changes; pick them up.
    const mo = new MutationObserver(onChange)
    mo.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onChange)
    scan()

    return () => {
      mo.disconnect()
      io?.disconnect()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onChange)
    }
  }, [])

  return <div ref={bar} className="progress" aria-hidden="true" />
}
