'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS: [string, string][] = [
  ['/admin', 'Overview'],
  ['/admin/articles', 'Articles'],
  ['/admin/topics', 'Topics'],
  ['/admin/content', 'Site content'],
  ['/admin/about', 'About page'],
  ['/admin/readers', 'Readers'],
  ['/admin/subscribers', 'Subscribers'],
  ['/admin/newsletter', 'Newsletter'],
  ['/admin/settings', 'Settings'],
]

export default function AdminNav() {
  const pathname = usePathname() ?? ''
  return (
    <nav className="admin-nav" aria-label="Admin">
      {ITEMS.map(([href, label]) => {
        const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
        return (
          <Link key={href} href={href} aria-current={active ? 'page' : undefined}>
            {label}
          </Link>
        )
      })}
      <Link href="/" className="admin-nav-site">
        View site
      </Link>
    </nav>
  )
}
