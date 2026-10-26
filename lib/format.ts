// Dates are shown in Lagos time (UTC+1, no daylight saving).
const TIME_ZONE = 'Africa/Lagos'
const OFFSET_MINUTES = 60

function valid(iso?: string | null): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatDate(iso?: string | null, style: 'long' | 'short' = 'long'): string {
  const d = valid(iso)
  if (!d) return ''
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: style === 'long' ? 'long' : 'short',
    year: 'numeric',
    timeZone: TIME_ZONE,
  }).format(d)
}

export function formatDateTime(iso?: string | null): string {
  const d = valid(iso)
  if (!d) return ''
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  }).format(d)
}

// ISO timestamp -> value for <input type="datetime-local"> in Lagos time.
export function toLocalInput(iso?: string | null): string {
  const d = valid(iso)
  if (!d) return ''
  return new Date(d.getTime() + OFFSET_MINUTES * 60000).toISOString().slice(0, 16)
}

// <input type="datetime-local"> value in Lagos time -> ISO timestamp.
export function fromLocalInput(value: string): string | null {
  if (value.length !== 16 || value.charAt(10) !== 'T') return null
  const d = new Date(`${value}:00+01:00`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function formatPrice(amount: number, currency: string): string {
  const whole = Number.isInteger(amount)
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount}`
  }
}

export function readingTime(minutes: number): string {
  return `${Math.max(1, minutes)} min read`
}
