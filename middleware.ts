import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createPlainClient } from '@supabase/supabase-js'
import { OFFLINE_DEFAULT_TITLE, OFFLINE_HEADER, OFFLINE_PREVIEW_PATH, offlinePage, openWhileOffline, type OfflineState } from '@/lib/offline'
import { site } from '@/lib/site'

// The site's one address (chidera.co). The same site also answers at its vercel.app addresses; those send
// visitors on, so search engines see a single copy of every page.
const CANONICAL_HOST = (() => {
  try {
    const url = new URL(site.url)
    return url.hostname === 'localhost' ? '' : url.host
  } catch {
    return ''
  }
})()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ''

/* Whether the website is switched off (Admin → Settings) --------------------------------------------
   Each server remembers the answer for a few seconds instead of asking the database on every request.
   After FRESH it still answers from memory but checks again in the background; after STALE it waits for the
   database. So switching the site off or on reaches every visitor within STALE. */

const FRESH = 5_000
const STALE = 15_000
const ONLINE: OfflineState = { offline: false, title: OFFLINE_DEFAULT_TITLE, note: '' }

const settings = SUPABASE_URL
  ? createPlainClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null
let known: { state: OfflineState; at: number } | null = null
let checking: Promise<OfflineState> | null = null

function check(): Promise<OfflineState> {
  checking ??= (async () => {
    try {
      if (!settings) return ONLINE
      const { data, error } = await settings
        .from('site_settings')
        .select('site_offline,offline_title,offline_note')
        .eq('id', true)
        .abortSignal(AbortSignal.timeout(3000))
        .maybeSingle()
      if (error) throw error
      const row = data as { site_offline?: boolean; offline_title?: string | null; offline_note?: string | null } | null
      const state: OfflineState = {
        offline: row?.site_offline === true,
        title: String(row?.offline_title ?? '').trim() || OFFLINE_DEFAULT_TITLE,
        note: String(row?.offline_note ?? ''),
      }
      known = { state, at: Date.now() }
      return state
    } catch {
      // The database didn't answer: keep the last answer (or keep the site open) and try again shortly.
      const state = known?.state ?? ONLINE
      known = { state, at: Date.now() - FRESH + 2_000 }
      return state
    } finally {
      checking = null
    }
  })()
  return checking
}

async function offlineState(event: NextFetchEvent): Promise<OfflineState> {
  const age = known ? Date.now() - known.at : Infinity
  if (known && age < FRESH) return known.state
  if (known && age < STALE) {
    event.waitUntil(check())
    return known.state
  }
  return check()
}

// Signed-in people the middleware has already looked up, so the admin isn't checked on every click.
const admins = new Map<string, { admin: boolean; at: number }>()

async function isAdmin(userId: string, lookup: () => PromiseLike<{ data: unknown; error: unknown }>): Promise<boolean> {
  const hit = admins.get(userId)
  if (hit && Date.now() - hit.at < 60_000) return hit.admin
  const { data, error } = await lookup()
  if (error) return hit?.admin ?? false
  const profile = data as { role?: string; status?: string } | null
  const admin = profile?.role === 'admin' && profile?.status === 'active'
  if (admins.size > 500) admins.clear()
  admins.set(userId, { admin, at: Date.now() })
  return admin
}

const PAGE_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
}

// Keeps the Supabase session fresh, sends signed-out visitors away from private areas,
// and shows the "not available" page while the website is switched off.
export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const host = request.headers.get('host') ?? ''
  if (process.env.VERCEL_ENV === 'production' && CANONICAL_HOST && host !== CANONICAL_HOST && host.endsWith('.vercel.app')) {
    return NextResponse.redirect(new URL(request.nextUrl.pathname + request.nextUrl.search, `https://${CANONICAL_HOST}`), 308)
  }

  // Only this middleware says whether the site is off; a header sent by the browser is ignored.
  request.headers.delete(OFFLINE_HEADER)
  let response = NextResponse.next({ request })

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Every answer carries the refreshed sign-in, or the reader would be signed out.
  const withSession = (res: NextResponse): NextResponse => {
    response.cookies.getAll().forEach((cookie) => res.cookies.set(cookie))
    return res
  }

  const path = request.nextUrl.pathname
  if (!user && (path.startsWith('/admin') || path.startsWith('/account'))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('next', path + request.nextUrl.search)
    return withSession(NextResponse.redirect(url))
  }

  const preview = path === OFFLINE_PREVIEW_PATH
  const site = await offlineState(event)
  if (!site.offline && !preview) return response

  const admin = user
    ? await isAdmin(user.id, () => supabase.from('profiles').select('role,status').eq('id', user.id).maybeSingle())
    : false

  if (preview) {
    // Only the admin can preview the page while the site is on; for anyone else it's a missing page.
    if (!admin && !site.offline) return response
    return withSession(
      new NextResponse(offlinePage(site, { preview: admin }), { status: admin ? 200 : 503, headers: PAGE_HEADERS })
    )
  }

  if (admin) {
    // The admin sees the whole site, with a reminder that visitors don't (app/layout.tsx).
    request.headers.set(OFFLINE_HEADER, '1')
    return withSession(NextResponse.next({ request }))
  }

  if (openWhileOffline(path)) return response

  if (path.startsWith('/api/')) {
    return withSession(NextResponse.json({ error: site.title }, { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '3600' } }))
  }
  // 503 tells search engines the site is down for now, so they keep its pages and come back later.
  return withSession(new NextResponse(offlinePage(site), { status: 503, headers: { ...PAGE_HEADERS, 'Retry-After': '3600' } }))
}

export const config = {
  // Files in public (pictures, fonts, and the games in public/games) skip it, so they load even while the site is off.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|js)$).*)'],
}
