import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createPlainClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { SUPABASE_KEY, SUPABASE_URL } from '@/lib/site'

// Request-scoped client that acts as the signed-in reader (or anonymous visitor).
// Row-level security in the database decides what it can see.
export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Called from a Server Component; the middleware refreshes the session instead.
        }
      },
    },
  })
}

export type ServerClient = Awaited<ReturnType<typeof createClient>>

// Cookie-less anonymous client for public, cacheable data (sitemap, share images).
export function createPublicClient() {
  return createPlainClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
