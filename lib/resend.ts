// Email delivery through Resend's HTTP API (https://resend.com/docs/api-reference).
// Server only: the API key is read from the environment here and never reaches the browser.
//
//   RESEND_API_KEY        an API key with sending access
//   NEWSLETTER_FROM       the sender, e.g.  Chidera’s Note <newsletter@chidera.co>  (a verified domain in Resend)
//   NEWSLETTER_REPLY_TO   optional: where replies go, e.g. your own inbox

const API = 'https://api.resend.com'
const TIMEOUT_MS = 25_000

export type OutgoingEmail = { to: string; subject: string; html: string; text: string; headers?: Record<string, string> }

export type SendFailure = {
  ok: false
  // rate_limited / busy / unavailable: nothing was sent, or a retry with the same key is safe; try again shortly.
  // quota: the Resend plan's sending limit is used up. setup: the key, sender or domain needs fixing.
  // invalid: Resend refused these addresses. conflict: the key was already used for a different message.
  kind: 'rate_limited' | 'busy' | 'unavailable' | 'quota' | 'setup' | 'invalid' | 'conflict'
  message: string
  retryAfterMs?: number
}
export type SendResult = { ok: true; ids: string[] } | SendFailure

export function mailSettings() {
  const apiKey = (process.env.RESEND_API_KEY ?? '').trim()
  const from = (process.env.NEWSLETTER_FROM ?? '').trim()
  const replyTo = (process.env.NEWSLETTER_REPLY_TO ?? '').trim()
  const missing = [apiKey ? '' : 'RESEND_API_KEY', from ? '' : 'NEWSLETTER_FROM'].filter(Boolean)
  // Resend's shared test sender (onboarding@resend.dev) only delivers to the Resend account's own address.
  const testSender = /@resend[.]dev>?$/i.test(from)
  return { ready: missing.length === 0, missing, apiKey, from, replyTo: replyTo || undefined, testSender }
}

type ResendError = { name?: string; message?: string }

function failure(status: number, body: ResendError, retryAfter: string | null): SendFailure {
  const name = body.name ?? ''
  const message = body.message || `The email service answered with an error (${status}).`
  if (status === 429) {
    if (name.includes('quota')) {
      return { ok: false, kind: 'quota', message: `Resend’s sending limit for your plan has been reached (${message}). Sending can carry on once it resets.` }
    }
    const seconds = Number.parseFloat(retryAfter ?? '')
    return { ok: false, kind: 'rate_limited', message, retryAfterMs: Number.isFinite(seconds) ? Math.max(seconds * 1000, 500) : 1500 }
  }
  if (status === 409) {
    if (name === 'concurrent_idempotent_requests') return { ok: false, kind: 'busy', message, retryAfterMs: 2000 }
    return { ok: false, kind: 'conflict', message }
  }
  if (status === 401 || status === 403 || name === 'invalid_from_address' || name.includes('api_key')) {
    return { ok: false, kind: 'setup', message }
  }
  if (status === 400 || status === 422) return { ok: false, kind: 'invalid', message }
  return { ok: false, kind: 'unavailable', message, retryAfterMs: 3000 }
}

async function post(path: string, payload: unknown, idempotencyKey?: string): Promise<{ ok: true; body: unknown } | SendFailure> {
  const { apiKey } = mailSettings()
  let res: Response
  try {
    res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    return { ok: false, kind: 'unavailable', message: 'Couldn’t reach Resend. It will be tried again.', retryAfterMs: 3000 }
  }
  const body = (await res.json().catch(() => ({}))) as unknown
  if (!res.ok) return failure(res.status, (body ?? {}) as ResendError, res.headers.get('retry-after'))
  return { ok: true, body }
}

function message(email: OutgoingEmail) {
  const { from, replyTo } = mailSettings()
  return {
    from,
    to: [email.to],
    subject: email.subject,
    html: email.html,
    text: email.text,
    ...(replyTo ? { reply_to: replyTo } : {}),
    ...(email.headers ? { headers: email.headers } : {}),
  }
}

// Up to 100 emails in one request. The key lets a retry of the same batch be recognised, so it isn't sent twice.
export async function sendBatch(emails: OutgoingEmail[], idempotencyKey: string): Promise<SendResult> {
  const result = await post('/emails/batch', emails.map(message), idempotencyKey)
  if (!result.ok) return result
  const data = (result.body as { data?: { id?: string }[] }).data ?? []
  return { ok: true, ids: emails.map((_, i) => data[i]?.id ?? '') }
}

export async function sendOne(email: OutgoingEmail, idempotencyKey?: string): Promise<SendResult> {
  const result = await post('/emails', message(email), idempotencyKey)
  if (!result.ok) return result
  return { ok: true, ids: [(result.body as { id?: string }).id ?? ''] }
}
