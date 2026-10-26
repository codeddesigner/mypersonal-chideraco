'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

type Item = { href: string; label: string }

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function SiteNav({ links, account }: { links: Item[]; account: Item }) {
  const pathname = usePathname() ?? '/'
  const menu = useRef<HTMLDetailsElement>(null)

  const close = () => {
    if (menu.current) menu.current.open = false
  }
  useEffect(close, [pathname])

  const current = (href: string) => (isActive(pathname, href) ? 'page' : undefined)

  return (
    <header className="nav">
      <Link href="/" className="nav-brand" aria-current={pathname === '/' ? 'page' : undefined}>
        Chidera’s Note
      </Link>

      <nav aria-label="Main" className="nav-links">
        {links.map((link) => (
          <Link key={link.href} href={link.href} aria-current={current(link.href)}>
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="nav-actions">
        <Link href="/search" className="icon-btn" aria-label="Search" aria-current={current('/search')}>
          <SearchIcon />
        </Link>
        <Link href={account.href} className="icon-btn nav-account" aria-label={account.label} aria-current={current(account.href)}>
          <PersonIcon />
        </Link>
        <details className="menu" ref={menu}>
          <summary className="icon-btn" aria-label="Menu">
            <MenuIcon />
          </summary>
          <nav aria-label="Mobile" className="menu-panel">
            {[...links, account].map((link) => (
              <Link key={link.href} href={link.href} onClick={close} aria-current={current(link.href)}>
                {link.label}
              </Link>
            ))}
          </nav>
        </details>
      </div>
    </header>
  )
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m20 20-4.6-4.6" />
    </svg>
  )
}

function PersonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M4.5 20.5c1.4-3.6 4.2-5.4 7.5-5.4s6.1 1.8 7.5 5.4" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M4 8h16M4 16h16" />
    </svg>
  )
}
