export function one(value: string | string[] | undefined | null): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value ?? undefined
}

export function slugify(input: string): string {
  // Decompose accented letters and drop the combining marks (U+0300 to U+036F).
  const plain = Array.from(input.toLowerCase().normalize('NFKD'))
    .filter((ch) => ch.charCodeAt(0) < 0x300 || ch.charCodeAt(0) > 0x36f)
    .join('')
  return plain
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '')
}

// Only allow same-site relative paths as post-login destinations.
export function safeNext(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 500) return fallback
  if (!value.startsWith('/')) return fallback
  if (value.charAt(1) === '/' || value.charCodeAt(1) === 92) return fallback
  if (/^\/(login|signup|auth)(\/|\?|$)/.test(value)) return fallback
  return value
}

export function buildHref(path: string, params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, raw] of Object.entries(params)) {
    if (raw === undefined || raw === null || raw === '') continue
    if (key === 'page' && Number(raw) <= 1) continue
    if (key === 'sort' && raw === 'arranged') continue
    search.set(key, String(raw))
  }
  const qs = search.toString()
  return qs ? `${path}?${qs}` : path
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

// A title written over several lines, on one line (for page titles, link previews and search engines).
export function oneLine(text: string): string {
  return text
    .split(String.fromCharCode(10))
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
}

// Typographic apostrophes for display titles ("Don't" becomes "Don’t").
export function curlyApostrophes(text: string): string {
  return text.replace(/(\w)'/g, '$1’')
}
