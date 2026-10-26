import { Schema, type Node as DocNode } from 'prosemirror-model'
import { MarkdownParser, MarkdownSerializer, defaultMarkdownParser, defaultMarkdownSerializer } from 'prosemirror-markdown'
import { articleMarkdown, prepareMarkdown } from './markdown'

// The article as the visual editor holds it (components/ArticleBodyEditor.tsx): paragraphs, headings,
// quotes, lists, dividers, pictures, and bold, italic, links and the like inside them.
// It's stored as the same Markdown text as before, read with the article page's own reader (lib/markdown.ts),
// so whatever the editor shows is what the article shows.

export const articleSchema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { content: 'inline*', group: 'block', parseDOM: [{ tag: 'p' }], toDOM: () => ['p', 0] },
    heading: {
      attrs: { level: { default: 2 } },
      content: '(text | image)*',
      group: 'block',
      defining: true,
      // The title is the page's only big heading, so a pasted h1 becomes a heading like the others.
      parseDOM: [1, 2, 3, 4, 5, 6].map((level) => ({ tag: `h${level}`, attrs: { level: Math.max(2, level) } })),
      toDOM: (node) => [`h${node.attrs.level}`, 0],
    },
    blockquote: { content: 'block+', group: 'block', defining: true, parseDOM: [{ tag: 'blockquote' }], toDOM: () => ['blockquote', 0] },
    bullet_list: {
      content: 'list_item+',
      group: 'block',
      attrs: { tight: { default: true } },
      parseDOM: [{ tag: 'ul' }],
      toDOM: () => ['ul', 0],
    },
    ordered_list: {
      content: 'list_item+',
      group: 'block',
      attrs: { order: { default: 1 }, tight: { default: true } },
      parseDOM: [{ tag: 'ol', getAttrs: (dom) => ({ order: Number((dom as HTMLElement).getAttribute('start') ?? 1) || 1 }) }],
      toDOM: (node) => ['ol', node.attrs.order === 1 ? {} : { start: node.attrs.order }, 0],
    },
    list_item: { content: 'paragraph block*', defining: true, parseDOM: [{ tag: 'li' }], toDOM: () => ['li', 0] },
    horizontal_rule: { group: 'block', parseDOM: [{ tag: 'hr' }], toDOM: () => ['hr'] },
    code_block: {
      content: 'text*',
      group: 'block',
      code: true,
      defining: true,
      marks: '',
      attrs: { params: { default: '' } },
      parseDOM: [{ tag: 'pre', preserveWhitespace: 'full' }],
      toDOM: () => ['pre', ['code', 0]],
    },
    text: { group: 'inline' },
    image: {
      inline: true,
      group: 'inline',
      draggable: true,
      attrs: { src: {}, alt: { default: null }, title: { default: null } },
      parseDOM: [
        {
          tag: 'img[src]',
          getAttrs: (dom) => {
            const el = dom as HTMLElement
            return { src: el.getAttribute('src'), alt: el.getAttribute('alt'), title: el.getAttribute('title') }
          },
        },
      ],
      toDOM: (node) => ['img', { src: node.attrs.src, alt: node.attrs.alt ?? '', title: node.attrs.title }],
    },
    hard_break: { inline: true, group: 'inline', selectable: false, parseDOM: [{ tag: 'br' }], toDOM: () => ['br'] },
  },
  marks: {
    strong: {
      parseDOM: [
        { tag: 'strong' },
        // Google Docs wraps everything in <b style="font-weight:normal">, which isn't bold at all.
        { tag: 'b', getAttrs: (dom) => (dom as HTMLElement).style.fontWeight !== 'normal' && null },
        { style: 'font-weight', getAttrs: (value) => /^(bold(er)?|[5-9]\d{2,})$/.test(value as string) && null },
      ],
      toDOM: () => ['strong', 0],
    },
    em: { parseDOM: [{ tag: 'em' }, { tag: 'i' }, { style: 'font-style=italic' }], toDOM: () => ['em', 0] },
    link: {
      attrs: { href: {}, title: { default: null } },
      inclusive: false,
      parseDOM: [
        {
          tag: 'a[href]',
          getAttrs: (dom) => {
            const el = dom as HTMLElement
            return { href: el.getAttribute('href'), title: el.getAttribute('title') }
          },
        },
      ],
      toDOM: (mark) => ['a', { href: mark.attrs.href, title: mark.attrs.title, rel: 'noopener' }, 0],
    },
    strike: { parseDOM: [{ tag: 's' }, { tag: 'del' }, { tag: 'strike' }], toDOM: () => ['s', 0] },
    code: { parseDOM: [{ tag: 'code' }], toDOM: () => ['code', 0] },
  },
})

const parser = new MarkdownParser(articleSchema, articleMarkdown, {
  ...defaultMarkdownParser.tokens,
  // Inside quotes and lists a single new line is a line break (the article page reads it that way too).
  softbreak: { node: 'hard_break' },
  s: { mark: 'strike' },
})

// How many lists of the same kind come straight before this one.
function listsBefore(parent: DocNode, index: number, node: DocNode): number {
  let count = 0
  for (let i = index - 1; i >= 0 && parent.child(i).type === node.type; i--) count++
  return count
}

const serializer = new MarkdownSerializer(
  {
    ...defaultMarkdownSerializer.nodes,
    // Two lists in a row stay two lists: the second is written with the other marker, as Markdown needs.
    bullet_list(state, node, parent, index) {
      const marker = listsBefore(parent, index, node) % 2 ? '* ' : '- '
      state.renderList(node, '  ', () => marker)
    },
    ordered_list(state, node, parent, index) {
      const start = (node.attrs.order as number) || 1
      const width = String(start + node.childCount - 1).length
      const delimiter = listsBefore(parent, index, node) % 2 ? ') ' : '. '
      state.renderList(node, ' '.repeat(width + 2), (i) => {
        const n = String(start + i)
        return ' '.repeat(width - n.length) + n + delimiter
      })
    },
    // A line break inside a paragraph: two spaces and a new line, the same as the plain text box wrote.
    hard_break(state, node, parent, index) {
      for (let i = index + 1; i < parent.childCount; i++) {
        if (parent.child(i).type !== node.type) {
          state.write('  \n')
          return
        }
      }
    },
  },
  {
    ...defaultMarkdownSerializer.marks,
    strike: { open: '~~', close: '~~', mixable: true, expelEnclosingWhitespace: true },
  },
)

// Throws if the text uses something the editor can't show (a table, say); the plain text box takes over then.
export function parseArticle(markdown: string): DocNode {
  return parser.parse(prepareMarkdown(markdown))
}

export function serializeArticle(doc: DocNode): string {
  // An empty article is stored as empty text, not as an empty paragraph.
  if (doc.childCount === 1 && doc.firstChild?.type.name === 'paragraph' && doc.firstChild.content.size === 0) return ''
  return serializer.serialize(doc).trim()
}
