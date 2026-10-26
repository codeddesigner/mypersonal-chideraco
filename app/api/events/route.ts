import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { EVENT_NAMES, type EventName, track } from '@/lib/analytics'
import { isUuid } from '@/lib/utils'

const ALLOWED = new Set<string>(EVENT_NAMES)
const text = (value: unknown, max: number) => (typeof value === 'string' && value ? value.slice(0, max) : null)

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = JSON.parse(await request.text())
  } catch {
    return new NextResponse(null, { status: 400 })
  }
  const name = typeof body.name === 'string' ? body.name : ''
  if (!ALLOWED.has(name)) return new NextResponse(null, { status: 400 })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const articleId = typeof body.article_id === 'string' && isUuid(body.article_id) ? body.article_id : null

  await track(supabase, {
    name: name as EventName,
    user_id: user?.id ?? null,
    article_id: articleId,
    path: text(body.path, 300),
    topic: text(body.topic, 100),
    query: text(body.query, 200),
  })
  return new NextResponse(null, { status: 204 })
}
