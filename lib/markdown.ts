import MarkdownIt from 'markdown-it'

// Raw HTML is disabled, so article text is escaped; markdown-it also rejects
// javascript: and similar link schemes.
//
// The text is written the way people type in a word processor:
// - Enter starts a new paragraph, so each line typed is its own paragraph.
// - Shift+Enter in the editor adds a line break inside a paragraph (written as two spaces before the new line).
// - Inside a quote or a list, a single new line stays a line break, so poems and addresses keep their shape.
// Two Markdown rules that scatter pasted text are switched off: indented lines no longer turn into grey
// code boxes, and a line of dashes or equals signs under text no longer turns that text into a heading.
const md = new MarkdownIt({ html: false, linkify: true, typographer: true, breaks: true })
md.disable(['code', 'lheading'])

// The article title is the page's only h1.
md.core.ruler.push('demote_h1', (state) => {
  for (const token of state.tokens) {
    if ((token.type === 'heading_open' || token.type === 'heading_close') && token.tag === 'h1') {
      token.tag = 'h2'
    }
  }
  return true
})

// Splits each top-level paragraph at its single line breaks, so every line is a paragraph of its own.
// A break inside bold, italic or a link is left as a line break so the formatting stays whole.
md.core.ruler.push('lines_are_paragraphs', (state) => {
  const tokens = state.tokens
  const out: typeof tokens = []
  for (let i = 0; i < tokens.length; i++) {
    const open = tokens[i]
    const inline = tokens[i + 1]
    const close = tokens[i + 2]
    const splittable =
      open.type === 'paragraph_open' &&
      open.level === 0 &&
      !open.hidden &&
      inline?.type === 'inline' &&
      close?.type === 'paragraph_close' &&
      (inline.children ?? []).some((child) => child.type === 'softbreak')
    if (!splittable) {
      out.push(open)
      continue
    }

    const lines: (typeof tokens)[] = [[]]
    let depth = 0
    for (const child of inline.children ?? []) {
      if (child.type === 'softbreak' && depth === 0) {
        lines.push([])
        continue
      }
      depth += child.nesting
      lines[lines.length - 1].push(child)
    }
    for (const children of lines) {
      if (children.every((child) => child.type === 'text' && !child.content.trim())) continue
      const p = new state.Token('paragraph_open', 'p', 1)
      p.block = true
      p.map = open.map
      const text = new state.Token('inline', '', 0)
      text.children = children
      text.content = children.map((child) => child.content).join('')
      const end = new state.Token('paragraph_close', 'p', -1)
      end.block = true
      out.push(p, text, end)
    }
    i += 2
  }
  state.tokens = out
  return true
})

const renderImage = md.renderer.rules.image
md.renderer.rules.image = (tokens, idx, options, env, self) => {
  tokens[idx].attrSet('loading', 'lazy')
  tokens[idx].attrSet('decoding', 'async')
  return renderImage ? renderImage(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options)
}

const renderLink = md.renderer.rules.link_open
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const href = tokens[idx].attrGet('href') ?? ''
  if (/^https?:\/\//i.test(href)) tokens[idx].attrSet('rel', 'noopener')
  return renderLink ? renderLink(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options)
}

// Characters that sneak in when text is pasted from documents and web pages: non-breaking and narrow
// spaces (they stop lines wrapping where they should) become ordinary spaces; zero-width marks go.
const ODD_SPACES = new RegExp('[' + String.fromCharCode(0xa0, 0x2007, 0x202f) + ']', 'g')
const INVISIBLE = new RegExp('[' + String.fromCharCode(0x200b, 0x2060, 0xfeff) + ']', 'g')

export function cleanText(source: string): string {
  return source.replace(ODD_SPACES, ' ').replace(INVISIBLE, '')
}

const NL = String.fromCharCode(10)
const CR = new RegExp(String.fromCharCode(13), 'g')
const SPACE = '[ ' + String.fromCharCode(9) + ']'
const LIST_ITEM = new RegExp('^' + SPACE + '*([-*+]|[0-9]+[.)])' + SPACE)
const QUOTE = new RegExp('^' + SPACE + '*>')
const INDENTED = new RegExp('^' + SPACE)
const FENCE = new RegExp('^' + SPACE + '*(```|~~~)')

// A line typed straight after a list or a quote starts a new paragraph, as it would in a word processor,
// instead of being pulled into the last list item or the quote.
function separateBlocks(source: string): string {
  const lines = source.replace(CR, '').split(NL)
  const out: string[] = []
  let fenced = false
  for (const line of lines) {
    if (FENCE.test(line)) fenced = !fenced
    const prev = out.length > 0 ? out[out.length - 1] : ''
    if (!fenced && line.trim() && prev.trim()) {
      const afterList = LIST_ITEM.test(prev) && !LIST_ITEM.test(line) && !INDENTED.test(line)
      const afterQuote = QUOTE.test(prev) && !QUOTE.test(line)
      if (afterList || afterQuote) out.push('')
    }
    out.push(line)
  }
  return out.join(NL)
}

// The text as the renderer reads it. The article editor (lib/article-doc.ts) reads it the same way.
export function prepareMarkdown(source: string | null | undefined): string {
  return separateBlocks(cleanText(source ?? ''))
}

export function renderMarkdown(source: string | null | undefined): string {
  return md.render(prepareMarkdown(source))
}

// The same reader, for the article editor, so what's written there means exactly what the article shows.
export const articleMarkdown = md
