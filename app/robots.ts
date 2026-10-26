import type { MetadataRoute } from 'next'
import { site } from '@/lib/site'

// The sign-in pages aren't blocked here: they carry their own "don't list this page" tag, which search engines
// can only read if they're allowed to fetch the page.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/account', '/auth', '/api', '/search'] }],
    sitemap: `${site.url}/sitemap.xml`,
  }
}
