'use client'

import type { MouseEvent } from 'react'

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

// Glides back to the top instead of jumping, then moves focus to the main content.
// A wheel or touch during the glide hands control back to the reader.
export default function BackToTop({ className }: { className?: string }) {
  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()
    const main = document.getElementById('main')
    const land = () => {
      if (!main) return
      main.setAttribute('tabindex', '-1')
      main.focus({ preventScroll: true })
    }
    const start = window.scrollY
    if (start === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.scrollTo(0, 0)
      land()
      return
    }

    const duration = Math.min(1500, 600 + start * 0.18)
    const began = performance.now()
    let stopped = false
    const stop = () => {
      stopped = true
    }
    window.addEventListener('wheel', stop, { once: true, passive: true })
    window.addEventListener('touchstart', stop, { once: true, passive: true })

    const step = (now: number) => {
      if (stopped) return
      const t = Math.min(1, (now - began) / duration)
      window.scrollTo(0, Math.round(start * (1 - ease(t))))
      if (t < 1) {
        requestAnimationFrame(step)
        return
      }
      window.removeEventListener('wheel', stop)
      window.removeEventListener('touchstart', stop)
      land()
    }
    requestAnimationFrame(step)
  }

  return (
    <a href="#main" className={className} onClick={onClick}>
      Back to top
    </a>
  )
}
