import { ACCENT_KEYS } from './accent'
import { DEFAULT_CONTENT, toLines } from './content'
import { site } from './site'
import type { Settings } from './types'

const NEWLINE = String.fromCharCode(10)
const RETURN = String.fromCharCode(13)

export type Service = { title: string; text: string }
export type Role = { org: string; role: string; period: string; text: string; logo: string; branches: string }
export type Study = { title: string; org: string; period: string }
export type Hobby = { title: string; text: string }
export type Figure = { value: string; label: string }

// The shape of each list on the About page, with the longest text each field may hold.
// Hobbies are stored in the private table; the rest in the public settings row.
export const ABOUT_LISTS = {
  about_services: { max: 8, fields: { title: 80, text: 400 } },
  about_experience: { max: 20, fields: { org: 100, role: 100, period: 40, text: 700, logo: 500, branches: 1500 } },
  about_education: { max: 10, fields: { title: 120, org: 120, period: 40 } },
  about_hobbies: { max: 12, fields: { title: 60, text: 300 } },
  about_figures: { max: 4, fields: { value: 12, label: 100 } },
} as const

export type AboutListName = keyof typeof ABOUT_LISTS

// The three parts of the About page, in order. Personal life needs an access code.
export const ABOUT_VIEWS = [
  { id: 'overview', label: 'What I do' },
  { id: 'work', label: 'Work life' },
  { id: 'personal', label: 'Personal life' },
] as const
export type AboutView = (typeof ABOUT_VIEWS)[number]['id']

export function aboutView(value: string | undefined): AboutView {
  return ABOUT_VIEWS.some((view) => view.id === value) ? (value as AboutView) : 'overview'
}

// Visitors who entered a valid code carry it in this cookie; it is checked again on every visit.
export const ACCESS_COOKIE = 'about_access'
export const CODE_LENGTH = 5

// Five letters, any case, spaces and dashes ignored. Anything else is not a code.
export function normaliseCode(value: unknown): string {
  const letters = typeof value === 'string' ? value.replace(/[^A-Za-z]/g, '').toUpperCase() : ''
  return letters.length === CODE_LENGTH ? letters : ''
}

// Keeps only well-formed entries: objects whose fields are text, trimmed to their limits,
// with at least one field filled in. Works on stored JSON and on what the admin form sends.
export function cleanList(value: unknown, list: AboutListName): Record<string, string>[] {
  const { max, fields } = ABOUT_LISTS[list] as { max: number; fields: Record<string, number> }
  if (!Array.isArray(value)) return []
  const keys = Object.keys(fields)
  return value
    .map((item: unknown) => {
      const entry: Record<string, string> = {}
      for (const key of keys) {
        const raw = item && typeof item === 'object' ? (item as Record<string, unknown>)[key] : ''
        entry[key] = typeof raw === 'string' ? raw.split(RETURN).join('').trim().slice(0, fields[key]) : ''
      }
      return entry
    })
    .filter((entry) => keys.some((key) => entry[key]))
    .slice(0, max)
}

// The branches under a stop on the work journey: one per line, up to eight.
export function branchesOf(role: Role): string[] {
  return toLines(role.branches, 8).map((line) => line.slice(0, 160))
}

// Each stop on the journey takes one of the article colours, in turn.
export function stopAccent(index: number): string {
  return ACCENT_KEYS[index % ACCENT_KEYS.length]
}

// One or two capital letters for a company without a logo yet.
export function monogram(name: string): string {
  const words = name.trim().split(' ').filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].charAt(0).toUpperCase()
  return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase()
}

// The intro text: its first paragraph, up to the first empty line, is the large opening line; the rest is
// the writing section. Lines inside the opening stay as line breaks within it (Markdown's two spaces before
// a new line), so pressing Enter there breaks the opening rather than starting the writing section.
export function splitIntro(body: string): { lede: string; rest: string } {
  const lines = body.split(RETURN).join('').split(NEWLINE)
  const first = lines.findIndex((line) => line.trim().length > 0)
  if (first === -1) return { lede: '', rest: '' }
  let last = first
  while (last + 1 < lines.length && lines[last + 1].trim().length > 0) last++
  const lede = lines
    .slice(first, last + 1)
    .map((line) => line.trim())
    .join('  ' + NEWLINE)
  return { lede, rest: lines.slice(last + 1).join(NEWLINE).trim() }
}

export const ABOUT_FALLBACK =
  'I write about *business*, finance, *society*, religion, *relationships*, and the things that shape how we think and live.'

const isHttps = (value: string) => value.startsWith('https://')

export function aboutContent(settings: Settings) {
  const photoAlt = settings.about_photo_alt?.trim()
  return {
    intro: splitIntro(settings.about_body || ABOUT_FALLBACK),
    // The opening of "What I do": who I am, the credential, and the numbers.
    statement: (settings.about_statement ?? '').trim(),
    credential: (settings.about_credential ?? '').trim(),
    figures: (cleanList(settings.about_figures, 'about_figures') as Figure[]).filter((item) => item.value && item.label),
    photo: settings.about_photo_url
      ? { src: settings.about_photo_url, alt: photoAlt || `Photo of ${site.author}`, drawing: false }
      : { src: DEFAULT_CONTENT.portrait.src, alt: photoAlt || DEFAULT_CONTENT.portrait.alt, drawing: true },
    // Each entry needs its name to be shown; a stray description on its own is left out.
    services: (cleanList(settings.about_services, 'about_services') as Service[]).filter((item) => item.title),
    experience: (cleanList(settings.about_experience, 'about_experience') as Role[])
      .filter((item) => item.org || item.role)
      .map((item) => ({ ...item, logo: isHttps(item.logo) ? item.logo : '' })),
    education: (cleanList(settings.about_education, 'about_education') as Study[]).filter((item) => item.title || item.org),
    clients: toLines(settings.about_clients, 40).map((name) => name.slice(0, 80)),
  }
}

// Personal life, from the private table or the code-checked function. Anything malformed is dropped.
export function personalContent(raw: unknown): { personal: string; hobbies: Hobby[] } {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    personal: typeof row.personal === 'string' ? row.personal.trim() : '',
    hobbies: (cleanList(row.hobbies, 'about_hobbies') as Hobby[]).filter((item) => item.title),
  }
}
