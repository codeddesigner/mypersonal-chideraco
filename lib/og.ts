import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { site } from './site'

// A file the site serves, for drawing a card: `src` is a path such as /chidera-photo.webp or a full URL.
// Site files are read from the project when they're there (as during a build) and otherwise fetched from
// the live site; `local` names a project file to try first instead of the copy in public/.
export async function siteFile(src: string, local?: string): Promise<ArrayBuffer | null> {
  const remote = /^https?:\/\//i.test(src)
  if (!remote && !src.includes('..')) {
    try {
      const buf = await readFile(join(process.cwd(), local ?? join('public', src)))
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
    } catch {
      // Not in this copy of the project; fetch it instead.
    }
  }
  try {
    const res = await fetch(remote ? src : `${site.url}${src}`, { signal: AbortSignal.timeout(8000) })
    return res.ok ? await res.arrayBuffer() : null
  } catch {
    return null
  }
}

// Fetches just the glyphs needed for a social card from Google Fonts.
// Falls back to the renderer's built-in font if anything fails.
export async function googleFont(family: string, weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weight}&text=${encodeURIComponent(text)}`
    const css = await (await fetch(url)).text()
    const match = css.match(/src: url[(](.+?)[)] format[(]'(opentype|truetype)'[)]/)
    if (!match) return null
    const res = await fetch(match[1])
    return res.ok ? await res.arrayBuffer() : null
  } catch {
    return null
  }
}

type FontOption = { name: string; data: ArrayBuffer; weight: 400 | 500 | 600 | 700; style: 'normal' }

// Labels on the cards are set in Geist capitals, like the site's small labels.
export async function cardFonts(serifText: string, labelText: string): Promise<FontOption[]> {
  const [serif, label] = await Promise.all([googleFont('Newsreader', 500, serifText), googleFont('Geist', 500, labelText)])
  const fonts: FontOption[] = []
  if (serif) fonts.push({ name: 'Newsreader', data: serif, weight: 500, style: 'normal' })
  if (label) fonts.push({ name: 'Geist', data: label, weight: 500, style: 'normal' })
  return fonts
}

export function svgDataUri(svg: string) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}
