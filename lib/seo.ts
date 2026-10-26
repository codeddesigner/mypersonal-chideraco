import type { Metadata } from 'next'
import { DEFAULT_CONTENT } from '@/lib/content'
import { site } from '@/lib/site'
import type { SocialLink } from '@/lib/types'

// What search engines and link previews read about each page: the address to treat as the original
// (canonical), the title and description for previews, and structured data (JSON-LD) that says who
// Chidera is, what the site is called and what each article is.

// The RSS feed, offered on every page so feed readers can find it.
export const FEED = { 'application/rss+xml': [{ url: '/feed.xml', title: site.brand }] }

const abs = (path: string) => `${site.url}${path === '/' ? '' : path}` || '/'

// The site's share picture (app/opengraph-image.tsx, a drawing of the home page's opening section).
// A page that sets its own openGraph doesn't inherit it, so pageMetadata names it on every page.
export const SHARE_IMAGE_ALT = `${site.author}, ${site.role}, on ${site.brand}`
const SHARE_IMAGE = { url: '/opengraph-image', width: 1200, height: 630, type: 'image/png', alt: SHARE_IMAGE_ALT }

// Title, description, canonical address and link-preview tags for an ordinary page.
// A page that sets its own openGraph replaces the site-wide one, so every field is set here.
export function pageMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
  noindex = false,
}: {
  title?: string
  description?: string
  path: string
  absoluteTitle?: boolean
  noindex?: boolean
}): Metadata {
  const shownTitle = title ? (absoluteTitle ? title : `${title} | ${site.author}`) : `${site.author} | ${site.role}`
  return {
    ...(title ? { title: absoluteTitle ? { absolute: title } : title } : {}),
    ...(description ? { description } : {}),
    alternates: { canonical: path, types: FEED },
    openGraph: { type: 'website', url: path, siteName: site.brand, title: shownTitle, description: description ?? site.description, images: [SHARE_IMAGE] },
    twitter: { card: 'summary_large_image', title: shownTitle, description: description ?? site.description, images: [SHARE_IMAGE] },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  }
}

// Adds ?page=N to an address for page 2 onwards, so each page of a list is its own page to search engines.
export function pagedPath(path: string, page: number): string {
  return page > 1 ? `${path}?page=${page}` : path
}

export const PERSON_ID = `${site.url}/#person`
export const WEBSITE_ID = `${site.url}/#website`

export function personLd(links: SocialLink[] = []) {
  const sameAs = links.map((link) => link.url).filter((url) => /^https?:\/\//i.test(url))
  return {
    '@type': 'Person',
    '@id': PERSON_ID,
    name: site.author,
    jobTitle: site.role,
    description: site.description,
    url: abs('/about'),
    image: abs(DEFAULT_CONTENT.photo.src),
    ...(sameAs.length ? { sameAs } : {}),
  }
}

export function websiteLd() {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: site.brand,
    alternateName: [site.name, site.author],
    url: abs('/'),
    description: site.description,
    inLanguage: 'en',
    publisher: { '@id': PERSON_ID },
  }
}

// Home › … › the page itself.
export function breadcrumbLd(trail: { name: string; path: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((step, i) => ({ '@type': 'ListItem', position: i + 1, name: step.name, item: abs(step.path) })),
  }
}

export function graph(...nodes: object[]) {
  return { '@context': 'https://schema.org', '@graph': nodes }
}

// JSON for a <script type="application/ld+json">, with '<' escaped so text can't close the script early.
const LT_ESCAPE = String.fromCharCode(92) + 'u003c'
export function jsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, LT_ESCAPE)
}

export { abs as absoluteUrl }
