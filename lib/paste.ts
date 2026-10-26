// Turns text pasted into the article editor into the article's simple formatting.
// Rich text from Google Docs, Word, Pages, Notes or a web page keeps its headings, bold, italic, links,
// lists and quotes; colours, fonts, sizes, spacing and images are left behind.
// Runs in the browser only (it uses DOMParser).

const NL = String.fromCharCode(10)
const BACKSLASH = String.fromCharCode(92)
const WHITESPACE = new RegExp('[ ' + String.fromCharCode(9, 10, 13, 12, 0xa0, 0x2007, 0x202f) + ']+', 'g')
const INVISIBLE = new RegExp('[' + String.fromCharCode(0x200b, 0x2060, 0xfeff) + ']', 'g')
const CR = new RegExp(String.fromCharCode(13), 'g')
const LEADING_SPACE = new RegExp('^[ ' + String.fromCharCode(9, 0xa0) + ']+')
const TRAILING_SPACE = new RegExp('[ ' + String.fromCharCode(9, 0xa0) + ']+$')
const BULLET = new RegExp('^[' + String.fromCharCode(0x2022, 0x25e6, 0x25aa, 0x25cf, 0xb7) + '][ ' + String.fromCharCode(9, 0xa0) + ']*')
const ODD_SPACES = new RegExp('[' + String.fromCharCode(0xa0, 0x2007, 0x202f) + ']', 'g')
const MANY_BLANKS = new RegExp(NL + '{3,}', 'g')
const ORDERED_GLYPH = /^[0-9a-z]{1,3}[.)]/i

// Plain text: no stray indentation (which would otherwise read as a code block), bullets as list items,
// at most one blank line in a row, and ordinary spaces.
export function cleanPlain(text: string): string {
  return text
    .replace(CR, '')
    .replace(INVISIBLE, '')
    .split(NL)
    .map((line) => line.replace(LEADING_SPACE, '').replace(TRAILING_SPACE, '').replace(BULLET, '- ').replace(ODD_SPACES, ' '))
    .join(NL)
    .replace(MANY_BLANKS, NL + NL)
    .trim()
}

type Kind = 'p' | 'h2' | 'h3' | 'li' | 'oli' | 'hr'
type Segment = { text: string; bold: boolean; italic: boolean; href: string | null }
type Block = { kind: Kind; depth: number; quote: boolean; segments: Segment[] }
type Context = { bold: boolean; italic: boolean; href: string | null; lists: ('ul' | 'ol')[]; quote: boolean }

const SKIP = new Set(['STYLE', 'SCRIPT', 'META', 'TITLE', 'LINK', 'HEAD', 'IMG', 'PICTURE', 'VIDEO', 'AUDIO', 'SVG', 'CANVAS', 'IFRAME', 'OBJECT', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'NOSCRIPT', 'TEMPLATE'])
const PARAGRAPHS = new Set(['P', 'DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'MAIN', 'ASIDE', 'FIGURE', 'FIGCAPTION', 'PRE', 'ADDRESS', 'DD', 'DT', 'TR', 'CAPTION', 'CENTER'])

function styleOf(el: Element, property: string): string {
  const style = (el.getAttribute('style') ?? '').toLowerCase()
  for (const rule of style.split(';')) {
    const at = rule.indexOf(':')
    if (at > 0 && rule.slice(0, at).trim() === property) return rule.slice(at + 1).trim()
  }
  return ''
}

const isBoldWeight = (weight: string) => weight === 'bold' || weight === 'bolder' || Number.parseInt(weight, 10) >= 600

// Leading and trailing spaces go outside the markers, or Markdown wouldn't see the formatting.
function wrap(text: string, marker: string): string {
  const core = text.trim()
  if (!core) return text
  const start = text.slice(0, text.indexOf(core.charAt(0)))
  const end = text.slice(text.lastIndexOf(core.charAt(core.length - 1)) + 1)
  return start + marker + core + marker + end
}

function renderSegments(segments: Segment[], plain: boolean): string {
  // Merge neighbours that share formatting, so "**a** **b**" becomes "**a b**".
  const merged: Segment[] = []
  for (const seg of segments) {
    const last = merged[merged.length - 1]
    if (last && last.bold === seg.bold && last.italic === seg.italic && last.href === seg.href) last.text += seg.text
    else merged.push({ ...seg })
  }
  let out = ''
  for (let i = 0; i < merged.length; i++) {
    const seg = merged[i]
    if (seg.href && !plain) {
      // A link is written once, with all its pieces of text.
      let text = ''
      let j = i
      while (j < merged.length && merged[j].href === seg.href) text += merged[j++].text
      i = j - 1
      const label = text.trim() || seg.href
      out += text.slice(0, text.length - text.trimStart().length) + '[' + label + '](' + seg.href + ')' + (text.trimEnd() !== text ? ' ' : '')
      continue
    }
    let text = seg.text.split('*').join(BACKSLASH + '*')
    if (!plain && seg.text.trim()) {
      if (seg.bold && seg.italic) text = wrap(text, '***')
      else if (seg.bold) text = wrap(text, '**')
      else if (seg.italic) text = wrap(text, '*')
    }
    out += text
  }
  return out.replace(WHITESPACE, ' ').trim()
}

export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const blocks: Block[] = []
  let current: Block | null = null

  const finish = () => {
    if (current && (current.kind === 'hr' || current.segments.some((s) => s.text.trim()))) blocks.push(current)
    current = null
  }
  const start = (kind: Kind, ctx: Context) => {
    finish()
    current = { kind, depth: Math.max(0, ctx.lists.length - 1), quote: ctx.quote, segments: [] }
  }
  const add = (text: string, ctx: Context) => {
    if (!current) current = { kind: 'p', depth: 0, quote: ctx.quote, segments: [] }
    current.segments.push({ text, bold: ctx.bold, italic: ctx.italic, href: ctx.href })
  }

  const walk = (node: Node, ctx: Context) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? '').replace(INVISIBLE, '').replace(WHITESPACE, ' ')
      if (text) add(text, ctx)
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as Element
    const tag = el.tagName.toUpperCase()
    if (SKIP.has(tag)) return
    // Word marks its own bullets and numbers this way; the list item is recreated below instead.
    if (styleOf(el, 'mso-list') === 'ignore') return

    const weight = styleOf(el, 'font-weight')
    const fontStyle = styleOf(el, 'font-style')
    const next: Context = { ...ctx }
    if (tag === 'B' || tag === 'STRONG') next.bold = !weight || isBoldWeight(weight)
    else if (weight) next.bold = isBoldWeight(weight)
    if (tag === 'I' || tag === 'EM' || tag === 'CITE') next.italic = !fontStyle || fontStyle !== 'normal'
    else if (fontStyle) next.italic = fontStyle === 'italic' || fontStyle === 'oblique'
    if (tag === 'A') {
      const href = (el.getAttribute('href') ?? '').trim()
      next.href = /^(https?:|mailto:)/i.test(href) ? href : ctx.href
    }

    const children = (inner: Context) => el.childNodes.forEach((child) => walk(child, inner))

    if (tag === 'BR') {
      // A line break starts a new paragraph, the same as pressing Enter in the editor.
      if (current && (current.kind === 'p' || current.kind === 'h2' || current.kind === 'h3')) start('p', ctx)
      return
    }
    if (tag === 'HR') {
      start('hr', ctx)
      finish()
      return
    }
    if (/^H[1-6]$/.test(tag)) {
      start(tag === 'H1' || tag === 'H2' ? 'h2' : 'h3', ctx)
      children({ ...next, bold: false })
      finish()
      return
    }
    if (tag === 'UL' || tag === 'OL') {
      finish()
      children({ ...next, lists: [...ctx.lists, tag === 'OL' ? 'ol' : 'ul'] })
      finish()
      return
    }
    if (tag === 'LI') {
      start(ctx.lists[ctx.lists.length - 1] === 'ol' ? 'oli' : 'li', ctx.lists.length ? ctx : { ...ctx, lists: ['ul'] })
      children(next)
      finish()
      return
    }
    if (tag === 'BLOCKQUOTE') {
      finish()
      children({ ...next, quote: true })
      finish()
      return
    }
    if (tag === 'TD' || tag === 'TH') {
      if (current && current.segments.length) add(' ', ctx)
      children(next)
      return
    }
    if (PARAGRAPHS.has(tag)) {
      // Word writes list items as paragraphs marked with mso-list; Docs puts a paragraph inside each list item.
      const msoList = styleOf(el, 'mso-list')
      if (msoList) {
        const glyph = el.querySelector('[style*="mso-list"]')?.textContent?.trim() ?? ''
        start(ORDERED_GLYPH.test(glyph) ? 'oli' : 'li', ctx)
        children(next)
        finish()
        return
      }
      const inItem: boolean = current !== null && (current.kind === 'li' || current.kind === 'oli') && !current.segments.some((s) => s.text.trim())
      if (!inItem) start('p', ctx)
      children(next)
      if (!inItem) finish()
      return
    }
    children(next)
  }

  walk(doc.body, { bold: false, italic: false, href: null, lists: [], quote: false })
  finish()

  const lines: string[] = []
  let previous: Block | null = null
  for (const block of blocks) {
    let line: string
    if (block.kind === 'hr') line = '---'
    else if (block.kind === 'h2') line = '## ' + renderSegments(block.segments, true)
    else if (block.kind === 'h3') line = '### ' + renderSegments(block.segments, true)
    else if (block.kind === 'li') line = ' '.repeat(block.depth * 3) + '- ' + renderSegments(block.segments, false)
    else if (block.kind === 'oli') line = ' '.repeat(block.depth * 3) + '1. ' + renderSegments(block.segments, false)
    else line = renderSegments(block.segments, false)
    if (block.quote) line = '> ' + line
    const listItem = block.kind === 'li' || block.kind === 'oli'
    const sameList = previous !== null && listItem && (previous.kind === 'li' || previous.kind === 'oli')
    const sameQuote = previous !== null && block.quote && previous.quote
    if (lines.length) lines.push(sameList ? NL : sameQuote ? NL + '>' + NL : NL + NL)
    lines.push(line)
    previous = block
  }
  return lines.join('').trim()
}

// What the editor inserts for a paste: converted rich text when there is any, otherwise cleaned plain text.
export function pastedText(data: DataTransfer): string {
  const html = data.getData('text/html')
  const plain = data.getData('text/plain')
  if (html && /<(p|div|h[1-6]|li|b|strong|i|em|a|br|blockquote|span)[ >/]/i.test(html)) {
    try {
      const converted = htmlToMarkdown(html)
      if (converted) return converted
    } catch {
      // Fall back to the plain text below.
    }
  }
  return cleanPlain(plain)
}
