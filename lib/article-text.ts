// Helpers for article text, shared by Admin → Articles and Admin → Newsletter.

const NEWLINE = String.fromCharCode(10)
// Lines that aren't running text: headings, pictures, quotes, list items and dividers.
const NOT_PROSE = /^(#|![[]|>|[-*+] |[0-9]+[.)] |-{3,}$|_{3,}$|[*]{3,}$)/

// First two real paragraphs of the body, skipping headings, images, quotes, lists and dividers.
// Each line is a paragraph (Enter starts a new one), so the body is split line by line.
export function derivePreview(body: string): string {
  return body
    .split(NEWLINE)
    .map((p) => p.trim())
    .filter((p) => p && !NOT_PROSE.test(p))
    .slice(0, 2)
    .join(NEWLINE + NEWLINE)
}
