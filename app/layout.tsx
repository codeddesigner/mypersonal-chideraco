import type { Metadata, Viewport } from 'next'
import { Geist, Newsreader } from 'next/font/google'
import localFont from 'next/font/local'
import { headers } from 'next/headers'
import Link from 'next/link'
import type { ReactNode } from 'react'
import './globals.css'
import './line-breaks.css'
import './newsletter-popup.css'
import './offline.css'
import './reveal.css'
import './game-nudge.css'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { ClickTracker } from '@/components/Analytics'
import GameNudge from '@/components/GameNudge'
import Motion from '@/components/Motion'
import NewsletterPopup from '@/components/NewsletterPopup'
import { PAPER } from '@/lib/accent'
import { OFFLINE_HEADER, OFFLINE_PREVIEW_PATH } from '@/lib/offline'
import { FEED } from '@/lib/seo'
import { site } from '@/lib/site'

const serif = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  axes: ['opsz'],
  display: 'swap',
  variable: '--font-serif',
})

// Chidera SPAR, the site's own heading face (Regular only).
const display = localFont({
  src: './fonts/ChideraSpar-Regular.woff',
  weight: '400',
  style: 'normal',
  display: 'swap',
  variable: '--font-display',
})

const sans = Geist({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
})

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.author} | ${site.role}`, template: `%s | ${site.author}` },
  description: site.description,
  applicationName: site.siteName,
  alternates: { types: FEED },
  authors: [{ name: site.author }],
  openGraph: { type: 'website', siteName: site.siteName, title: `${site.author} | ${site.role}`, description: site.description },
  twitter: { card: 'summary_large_image' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: PAPER,
}

// Runs before first paint so sections that animate in start hidden instead of flashing.
// If the page's JavaScript hasn't started within four seconds, everything is shown as normal.
const MOTION_BOOT = `(function(){try{var d=document.documentElement;if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;d.setAttribute('data-motion','');setTimeout(function(){if(!d.hasAttribute('data-motion-ready'))d.removeAttribute('data-motion')},4000)}catch(e){}})()`

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Set by middleware.ts only when the website is switched off and the admin is the one looking.
  const offline = (await headers()).get(OFFLINE_HEADER) === '1'
  return (
    <html lang="en" className={`${display.variable} ${serif.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: MOTION_BOOT }} />
      </head>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {offline && (
          <p className="preview-banner offline-banner" role="status">
            <span>Your website is off. Only you can see it.</span>
            <a href={OFFLINE_PREVIEW_PATH}>See what visitors see</a>
            <Link href="/admin/settings#availability">Turn it back on</Link>
          </p>
        )}
        <Navbar />
        <div className="shell">
          <main id="main">{children}</main>
          <Footer />
        </div>
        <ClickTracker />
        <Motion />
        <NewsletterPopup />
        <GameNudge />
      </body>
    </html>
  )
}
