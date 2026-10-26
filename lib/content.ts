import { formatPrice } from './format'
import { site } from './site'
import type { Settings } from './types'

const NEWLINE = String.fromCharCode(10)
const RETURN = String.fromCharCode(13)

// The copy the site shipped with. It shows until something is saved in Admin → Site content.
export const DEFAULT_CONTENT = {
  heroLines: ['Perspectives that affect', 'how you relate to', 'the world.'],
  portrait: { src: '/chidera-portrait.svg', alt: `Illustrated portrait of ${site.author}`, width: 966, height: 1313 },
  photo: { src: '/chidera-photo.webp', alt: `Photo of ${site.author}`, width: 720, height: 901 },
  footerAbout: 'Writing on business, finance, faith, relationships and everyday life.',
  newsletterHeading: ['Be the first to hear about', 'new articles, for {price}.'],
}

export const PRICE_TOKEN = '{price}'

// Text typed one line per row, cleaned up: no blank rows, no stray spaces, at most `max` lines.
export function toLines(value: string | null | undefined, max: number): string[] {
  if (!value) return []
  return value
    .split(RETURN)
    .join('')
    .split(NEWLINE)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, max)
}

export const joinLines = (lines: string[]) => lines.join(NEWLINE)

export function heroLines(settings: Settings): string[] {
  const lines = toLines(settings.hero_lines, 4)
  return lines.length > 0 ? lines : DEFAULT_CONTENT.heroLines
}

/* Sizing the home page heading ------------------------------------------------
   The heading is sized so every line typed in admin stays on one line, however long it is.
   Widths are estimated in ems of the display face (Newsreader), slightly generously. */

const NARROW = new Set("fijlrt.,;:'’‘!|()-")
const WIDE = new Set('mwMW')

function textEm(text: string): number {
  let em = 0
  for (const ch of text) {
    if (ch === ' ') em += 0.22
    else if (NARROW.has(ch)) em += 0.3
    else if (WIDE.has(ch)) em += 0.78
    else if (ch !== ch.toLowerCase()) em += 0.62
    else em += 0.52
  }
  return em * 1.06
}

const HIGHLIGHT = 0.2 // the highlighter's padding either side
const ARROW = 1.9 // room for the arrow after the last line (it may hang a little past the words' column)
const PHONE_LINE = 9 // roughly how many ems fit across a phone at the smallest heading size

export type HeroLayout = { lines: string[][]; fit: number; fitSmall: number }

// Each line as one or two parts (two only where it's too long for a phone), plus the widest line in ems
// for wide screens (`fit`) and for phones (`fitSmall`). The page divides the column width by these.
export function heroLayout(lines: string[]): HeroLayout {
  const last = lines.length - 1
  const width = (text: string, withArrow: boolean) => textEm(text) + HIGHLIGHT + (withArrow ? ARROW : 0)
  let fit = 0
  let fitSmall = 0
  const parts = lines.map((line, i) => {
    const isLast = i === last
    const whole = width(line, isLast)
    fit = Math.max(fit, whole)
    let split = [line]
    let widest = whole
    const words = line.split(' ').filter(Boolean)
    if (whole > PHONE_LINE && words.length > 1) {
      // Break where the longer half is as short as possible.
      widest = Infinity
      for (let k = 1; k < words.length; k++) {
        const a = words.slice(0, k).join(' ')
        const b = words.slice(k).join(' ')
        const longer = Math.max(width(a, false), width(b, isLast))
        if (longer < widest) {
          widest = longer
          split = [a, b]
        }
      }
    }
    fitSmall = Math.max(fitSmall, widest)
    return split
  })
  const round = (n: number) => Math.round(n * 100) / 100
  return { lines: parts, fit: round(Math.max(fit, 6)), fitSmall: round(Math.max(fitSmall, 5)) }
}

// Each line's width in ems with the highlighter's padding, worked out the same way. The share image
// (app/opengraph-image.tsx) sizes its heading from these.
export function heroLineEms(lines: string[]): number[] {
  return lines.map((line) => textEm(line) + HIGHLIGHT)
}

export function portrait(settings: Settings): { src: string; alt: string; width?: number; height?: number } {
  const alt = settings.portrait_alt?.trim() || DEFAULT_CONTENT.portrait.alt
  if (settings.portrait_url) return { src: settings.portrait_url, alt }
  return { ...DEFAULT_CONTENT.portrait, alt }
}

// The large photo beside the home page heading.
export function heroPhoto(settings: Settings): { src: string; alt: string; width?: number; height?: number } {
  const alt = settings.hero_photo_alt?.trim() || DEFAULT_CONTENT.photo.alt
  if (settings.hero_photo_url) return { src: settings.hero_photo_url, alt }
  return { ...DEFAULT_CONTENT.photo, alt }
}

// The Subscribe page's words (Admin → Site content). The introduction's built-in wording depends on
// whether paid subscriptions are switched on.
export const SUBSCRIBE_DEFAULTS = {
  heading: 'Subscribe',
  intro: 'Support the writing and read every new article.',
  introPaid: 'Support the writing and read every article, including subscriber-only pieces.',
  artLine: 'Articles on business, finance, society, religion and love.',
}

export function subscribeContent(settings: Settings) {
  return {
    heading: settings.subscribe_heading?.trim() || SUBSCRIBE_DEFAULTS.heading,
    intro:
      settings.subscribe_intro?.trim() ||
      (settings.subscriptions_enabled ? SUBSCRIBE_DEFAULTS.introPaid : SUBSCRIBE_DEFAULTS.intro),
    artLine: settings.subscribe_art_line?.trim() || SUBSCRIBE_DEFAULTS.artLine,
    note: settings.subscribe_note?.trim() ?? '',
  }
}

export function footerAbout(settings: Settings): string {
  return settings.footer_about?.trim() || DEFAULT_CONTENT.footerAbout
}

export function priceLabel(settings: Settings): string {
  return `${formatPrice(settings.price_amount, settings.currency)}/${settings.billing_interval}`
}

// The sign-up heading as typed in admin, with {price} still in place.
export function newsletterTemplate(settings: Settings): string[] {
  const lines = toLines(settings.newsletter_heading, 3)
  return lines.length > 0 ? lines : DEFAULT_CONTENT.newsletterHeading
}

// The sign-up heading as readers see it, with the price filled in.
export function newsletterLines(settings: Settings): string[] {
  const price = priceLabel(settings)
  return newsletterTemplate(settings).map((line) => line.split(PRICE_TOKEN).join(price))
}
