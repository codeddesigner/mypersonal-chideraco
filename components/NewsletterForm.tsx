'use client'

import { useId, useState, type FormEvent } from 'react'

type Status = { kind: 'idle' | 'sending' | 'leaving' | 'done' | 'error'; message?: string }

const FAILED = 'That didn’t go through. Please try again in a moment.'

// The paid sign-up for new articles: the email is saved, then the reader goes on to payment.
// Works without JavaScript too: the form posts to the same route, which redirects.
// onDone runs once the email is saved (the sign-up pop-up uses it so it doesn't ask again).
export default function NewsletterForm({ source, note, onDone }: { source: string; note?: string; onDone?: () => void }) {
  const id = useId()
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const busy = status.kind === 'sending' || status.kind === 'leaving'

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setStatus({ kind: 'sending' })
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.get('email'), company: data.get('company'), source }),
      })
      const body = (await res.json().catch(() => ({}))) as { message?: string; redirect?: string }
      if (!res.ok) {
        setStatus({ kind: 'error', message: body.message || FAILED })
        return
      }
      onDone?.()
      if (body.redirect) {
        setStatus({ kind: 'leaving', message: body.message || 'Taking you to payment…' })
        window.location.assign(body.redirect)
        return
      }
      form.reset()
      setStatus({ kind: 'done', message: body.message || 'You’re on the list.' })
    } catch {
      setStatus({ kind: 'error', message: FAILED })
    }
  }

  return (
    <div className="newsletter-box">
      <form className="newsletter-form" action="/api/newsletter" method="post" onSubmit={submit}>
        <label htmlFor={`${id}-email`} className="sr-only">
          Email address
        </label>
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="Your email address"
          className="newsletter-input"
        />
        <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hp" aria-hidden="true" />
        <input type="hidden" name="source" value={source} />
        <button type="submit" className="btn" disabled={busy}>
          {status.kind === 'sending' ? 'Subscribing…' : 'Subscribe'}
        </button>
      </form>
      <p className={status.kind === 'error' ? 'newsletter-status error' : 'newsletter-status'} role="status" aria-live="polite">
        {status.message}
      </p>
      {note && <p className="newsletter-note">{note}</p>}
    </div>
  )
}
