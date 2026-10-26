import { renderMarkdown } from '@/lib/markdown'
import { slugify } from '@/lib/utils'

// Turns a newsletter written in Admin → Newsletter into the email itself. Used for the live preview in the
// admin page and for the emails that are sent, so what the preview shows is what people get.
//
// The message is written in the same Markdown as articles. markdown-it has raw HTML switched off and refuses
// javascript: and similar links, so nothing typed in the editor can add scripts or markup of its own.
// Email programs ignore style sheets, so every tag gets its styling written onto it.

export type NewsletterContent = { subject: string; preheader: string; body: string; cover?: EmailCover | null }
// The picture at the top of the email.
export type EmailCover = { url: string; alt: string }

// How a newsletter's cover is set: the generated artwork (a design and colour, like an article's),
// an uploaded image, or none.
export type CoverMode = 'none' | 'art' | 'image'
export type NewsletterCover = {
  cover_mode: CoverMode
  cover_image_url: string | null
  cover_alt: string
  cover_style: string | null
  accent: string | null
  cover_seed: string | null
}

// The artwork's details come from an address-like seed: the article's for a newsletter made from one,
// otherwise the subject's, so publishing it on the site gives the article the same artwork.
export function coverSeed(cover: Pick<NewsletterCover, 'cover_seed'>, subject: string): string {
  return cover.cover_seed || slugify(subject) || 'newsletter'
}

// The cover as an image an email program can show. The artwork is drawn as a PNG by /api/cover,
// because most email programs don't show SVG.
export function emailCover(cover: NewsletterCover, subject: string, siteUrl: string): EmailCover | null {
  if (cover.cover_mode === 'image') {
    return cover.cover_image_url ? { url: cover.cover_image_url, alt: cover.cover_alt } : null
  }
  if (cover.cover_mode !== 'art') return null
  const params = new URLSearchParams({ seed: coverSeed(cover, subject) })
  if (cover.cover_style) params.set('style', cover.cover_style)
  if (cover.accent) params.set('accent', cover.accent)
  return { url: `${siteUrl}/api/cover?${params}`, alt: '' }
}

export type EmailFrame = { siteUrl: string; brand: string; unsubscribeUrl: string }

const INK = '#142218'
const INK_2 = '#3f4d43'
const MUTED = '#5e6b62'
const PAPER = '#fafaf5'
const PAGE = '#efefe6'
const LEMON = '#e8ebb4'
const RULE = 'rgba(20,34,24,0.18)'
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"
const SERIF = "Georgia,'Times New Roman',serif"

const TAG_STYLES: Record<string, string> = {
  p: 'margin:0 0 18px;font-size:17px;line-height:1.6;',
  h2: `margin:32px 0 12px;font-family:${SERIF};font-size:26px;line-height:1.25;font-weight:400;color:${INK};`,
  h3: `margin:28px 0 10px;font-size:19px;line-height:1.35;font-weight:700;color:${INK};`,
  h4: `margin:24px 0 8px;font-size:17px;line-height:1.4;font-weight:700;color:${INK};`,
  h5: `margin:24px 0 8px;font-size:16px;line-height:1.4;font-weight:700;color:${INK};`,
  h6: `margin:24px 0 8px;font-size:15px;line-height:1.4;font-weight:700;color:${INK};`,
  ul: 'margin:0 0 18px;padding:0 0 0 24px;',
  ol: 'margin:0 0 18px;padding:0 0 0 24px;',
  li: 'margin:0 0 8px;font-size:17px;line-height:1.6;',
  blockquote: `margin:0 0 18px;padding:2px 0 2px 16px;border-left:3px solid ${INK};color:${INK_2};font-style:italic;`,
  hr: `border:0;border-top:1px solid ${RULE};margin:28px 0;`,
  pre: 'margin:0 0 18px;padding:14px 16px;background:#ecece4;border-radius:6px;white-space:pre-wrap;font-size:14px;line-height:1.5;',
  code: "font-family:Menlo,Consolas,'Courier New',monospace;font-size:15px;",
  img: 'display:block;max-width:100%;height:auto;margin:0 0 18px;border:0;',
  a: `color:${INK};text-decoration:underline;`,
  table: 'border-collapse:collapse;margin:0 0 18px;width:100%;',
  th: `border:1px solid ${RULE};padding:6px 8px;text-align:left;font-size:15px;`,
  td: `border:1px solid ${RULE};padding:6px 8px;font-size:15px;`,
}

const TAG = new RegExp('<(' + Object.keys(TAG_STYLES).join('|') + ')((?:\\s[^>]*)?)>', 'g')

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// The message as email-ready HTML: inline styles, and links to the site's own pages made absolute.
export function messageHtml(body: string, siteUrl: string): string {
  const html = renderMarkdown(body)
  return html.replace(TAG, (_match, tag: string, attrs: string) => {
    const absolute = attrs.replace(/ (href|src)="\/(?!\/)/g, ` $1="${siteUrl}/`)
    const extra = tag === 'a' ? ' target="_blank"' : ''
    return `<${tag}${absolute}${extra} style="${TAG_STYLES[tag]}">`
  })
}

// The plain-text copy sent alongside the HTML, for email programs that show text only.
export function messageText(content: NewsletterContent, frame: EmailFrame): string {
  const NL = String.fromCharCode(10)
  const body = content.body
    .replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, (_m, label: string, href: string) => `${label} (${href.startsWith('/') ? frame.siteUrl + href : href})`)
    .replace(/^#{1,6} +/gm, '')
    .replace(/^> ?/gm, '')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1$2')
    .replace(/ {2}$/gm, '')
    .replace(/\n{3,}/g, NL + NL)
    .trim()
  return [content.subject.trim(), '', body, '', '—', `${frame.brand} · ${frame.siteUrl}`, `Unsubscribe: ${frame.unsubscribeUrl}`].join(NL) + NL
}

// The whole email: a narrow column on a soft background, the subject as its heading, the message, and a
// footer that says why the reader is getting it and how to stop.
export function newsletterHtml(content: NewsletterContent, frame: EmailFrame): string {
  const subject = escapeHtml(content.subject.trim() || 'Untitled newsletter')
  const preheader = escapeHtml(content.preheader.trim())
  const site = escapeHtml(frame.siteUrl)
  const host = escapeHtml(frame.siteUrl.replace(/^https?:\/\//, ''))
  const brand = escapeHtml(frame.brand)
  const unsubscribe = escapeHtml(frame.unsubscribeUrl)
  // Padding after the preview text stops email programs filling the rest of the preview line with the message.
  const filler = '&#8203;&nbsp;'.repeat(60)

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:${PAGE};-webkit-text-size-adjust:100%;">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${preheader}${filler}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAGE};">
<tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:${PAPER};border:1px solid ${RULE};border-top:6px solid ${LEMON};">
<tr><td style="padding:26px 32px 0;font-family:${SERIF};font-size:20px;line-height:1.2;">
<a href="${site}" target="_blank" style="color:${INK};text-decoration:none;">${brand}</a>
</td></tr>
${
  content.cover
    ? `<tr><td style="padding:22px 32px 0;"><img src="${escapeHtml(content.cover.url)}" width="536" alt="${escapeHtml(content.cover.alt)}" style="display:block;width:100%;max-width:536px;height:auto;border:0;border-radius:6px;background:${LEMON};"></td></tr>
`
    : ''
}<tr><td style="padding:22px 32px 10px;font-family:${SANS};color:${INK};">
<h1 style="margin:0 0 20px;font-family:${SERIF};font-size:32px;line-height:1.15;font-weight:400;color:${INK};">${subject}</h1>
${messageHtml(content.body, frame.siteUrl)}
</td></tr>
<tr><td style="padding:18px 32px 26px;border-top:1px solid ${RULE};font-family:${SANS};font-size:13px;line-height:1.55;color:${MUTED};">
You’re getting this because you subscribed to ${brand} at <a href="${site}" target="_blank" style="color:${MUTED};">${host}</a>.<br>
<a href="${unsubscribe}" target="_blank" style="color:${INK_2};">Unsubscribe</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}
