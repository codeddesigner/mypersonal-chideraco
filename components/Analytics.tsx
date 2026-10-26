'use client'

import { useEffect } from 'react'

type Payload = { name: string; article_id?: string; topic?: string; query?: string; path?: string }

function send(payload: Payload) {
  try {
    const body = JSON.stringify({ ...payload, path: payload.path ?? window.location.pathname })
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/events', new Blob([body], { type: 'application/json' }))
    } else {
      void fetch('/api/events', { method: 'POST', body, keepalive: true, headers: { 'content-type': 'application/json' } })
    }
  } catch {
    // ignore
  }
}

// Records one event when the component mounts.
export function TrackEvent({ name, articleId, topic, query }: { name: string; articleId?: string; topic?: string; query?: string }) {
  useEffect(() => {
    send({ name, article_id: articleId, topic, query })
  }, [name, articleId, topic, query])
  return null
}

// Records clicks on any element marked with data-event="...".
export function ClickTracker() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-event]') : null
      if (!target) return
      const { event: name, article, topic } = target.dataset
      if (name) send({ name, article_id: article, topic })
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])
  return null
}
