import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { forbidden, isSameOrigin } from '@/lib/http'

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden()
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/', request.url), 303)
}
