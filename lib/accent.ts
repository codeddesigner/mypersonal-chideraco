import type { CSSProperties } from 'react'

// Each essay owns one colour. The panel, its cover art and its link accents use it.
// It is one of these named colours, or any colour picked on the colour wheel (stored as #rrggbb).
export const ACCENTS = {
  pool: { name: 'Pool', base: '#BFE3E8', deep: '#4F9AAB' },
  leaf: { name: 'Leaf', base: '#43BD8E', deep: '#1D6E50' },
  lemon: { name: 'Lemon', base: '#E8EBB4', deep: '#A8AE36' },
  blush: { name: 'Blush', base: '#F3CFC6', deep: '#B85F7A' },
  iris: { name: 'Iris', base: '#CFC8F2', deep: '#6E5CCB' },
  saffron: { name: 'Saffron', base: '#F5C845', deep: '#B5800F' },
} as const

export type AccentKey = keyof typeof ACCENTS
export const ACCENT_KEYS = Object.keys(ACCENTS) as AccentKey[]

export const INK = '#142218'
export const PAPER = '#FAFAF5'

export type Palette = { base: string; deep: string }

export function hashString(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function isAccent(value: unknown): value is AccentKey {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ACCENTS, value)
}

const HEX = /^#[0-9a-f]{6}$/

// '#ABCDEF', 'abcdef' and '#abcdef' all become '#abcdef'; anything else is ''.
export function normaliseHex(value: unknown): string {
  if (typeof value !== 'string') return ''
  const v = value.trim().toLowerCase()
  const hex = v.startsWith('#') ? v : `#${v}`
  return HEX.test(hex) ? hex : ''
}

// A stored colour is a named one or a hex colour from the wheel.
export function isStoredAccent(value: unknown): value is string {
  return isAccent(value) || (typeof value === 'string' && HEX.test(value))
}

// The stored named colour, or a stable one picked from the slug. Hex colours are handled by paletteFor.
export function accentFor(accent: string | null | undefined, seed: string): AccentKey {
  if (isAccent(accent)) return accent
  return ACCENT_KEYS[hashString(seed) % ACCENT_KEYS.length]
}

/* Colour maths for the wheel ------------------------------------------------ */

export type Hsl = { h: number; s: number; l: number }

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function hexToHsl(hex: string): Hsl {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
  }
  return { h, s: s * 100, l: l * 100 }
}

export function hslToHex({ h, s, l }: Hsl): string {
  const sat = Math.min(100, Math.max(0, s)) / 100
  const lig = Math.min(100, Math.max(0, l)) / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = sat * Math.min(lig, 1 - lig)
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const to = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0')
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

// Article text is dark ink on the article's colour, so a picked colour is lightened until ink stays easy to read.
export function readableBase(hex: string): string {
  let hsl = hexToHsl(hex)
  let out = hex
  for (let i = 0; i < 60 && contrast(out, INK) < 4.5; i++) {
    hsl = { ...hsl, l: Math.min(97, hsl.l + 1) }
    out = hslToHex(hsl)
  }
  return out
}

// The darker partner used for shapes in the cover art, in the same family as the named colours.
export function deepFor(hex: string): string {
  const { h, s, l } = hexToHsl(hex)
  return hslToHex({ h, s: Math.min(65, Math.max(25, s * 0.75)), l: Math.min(45, Math.max(22, l * 0.55)) })
}

// Base and deep colours for an article: a named colour, a wheel colour, or one picked from the slug.
export function paletteFor(accent: string | null | undefined, seed: string): Palette {
  const hex = normaliseHex(accent)
  if (hex && !isAccent(accent)) return { base: hex, deep: deepFor(hex) }
  const { base, deep } = ACCENTS[accentFor(accent, seed)]
  return { base, deep }
}

// Attributes that colour an element: data-accent for a named colour (styled in globals.css),
// or the two colour variables set directly for a wheel colour.
export function accentAttrs(accent: string | null | undefined, seed: string): { 'data-accent': string; style?: CSSProperties } {
  const hex = normaliseHex(accent)
  if (hex && !isAccent(accent)) {
    return { 'data-accent': 'custom', style: { '--panel': hex, '--deep': deepFor(hex) } as CSSProperties }
  }
  return { 'data-accent': accentFor(accent, seed) }
}

/* Text on an article's colour ------------------------------------------------ */

export const WHITE = '#ffffff'

// How readable text is on a background, from 0 (invisible) to about 106 (black on white).
// This is the APCA lightness contrast, which matches what people see better than the older ratio,
// especially for white text on mid-tone colours.
function screenLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => (v / 255) ** 2.4)
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b
  return y < 0.022 ? y + (0.022 - y) ** 1.414 : y
}

export function readability(text: string, background: string): number {
  const t = screenLuminance(text)
  const b = screenLuminance(background)
  if (Math.abs(b - t) < 0.0005) return 0
  if (b > t) {
    const c = (b ** 0.56 - t ** 0.57) * 1.14
    return c < 0.1 ? 0 : (c - 0.027) * 100
  }
  const c = (b ** 0.65 - t ** 0.62) * 1.14
  return c > -0.1 ? 0 : -(c + 0.027) * 100
}

export type Readability = { level: 'good' | 'fair' | 'poor'; label: string }

export function readabilityOf(text: string, background: string): Readability {
  const score = readability(text, background)
  if (score >= 55) return { level: 'good', label: 'Easy to read' }
  if (score >= 40) return { level: 'fair', label: 'The title reads well, but the small text is faint' }
  return { level: 'poor', label: 'Hard to read' }
}

// The text colour for an article: the one chosen in the editor (#rrggbb), or, when none is chosen,
// dark ink or white, whichever is easier to read on the article's colour.
export function textFor(base: string, chosen: string | null | undefined): string {
  const hex = normaliseHex(chosen)
  if (hex) return hex
  return readability(INK, base) >= readability(WHITE, base) ? INK : WHITE
}

// Attributes for a panel in the article's colour with text on it (the article header, the featured
// article, the previous/next links). Text, rules and the hand-drawn marks all take the text colour.
export function panelAttrs(
  accent: string | null | undefined,
  seed: string,
  textColour: string | null | undefined
): { 'data-accent': string; style?: CSSProperties } {
  const attrs = accentAttrs(accent, seed)
  const text = textFor(paletteFor(accent, seed).base, textColour)
  if (text === INK.toLowerCase() || text === INK) return attrs
  const [r, g, b] = hexToRgb(text)
  const tint = (alpha: number) => `rgba(${r}, ${g}, ${b}, ${alpha})`
  return {
    ...attrs,
    style: {
      ...attrs.style,
      '--ink': text,
      '--ink-2': text,
      '--muted': tint(0.8),
      '--line': tint(0.32),
      '--rule': tint(0.24),
      '--rule-strong': tint(0.45),
    } as CSSProperties,
  }
}
