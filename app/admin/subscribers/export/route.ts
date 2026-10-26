import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Row = { email: string; status: string; source: string | null; created_at: string; unsubscribed_at: string | null }

const NEWLINE = String.fromCharCode(10)
const cell = (value: string) => '"' + value.replaceAll('"', '""') + '"'

// The whole subscriber list as a CSV, with each person's status. Admins only.
export async function GET() {
  await requireAdmin()
  const supabase = await createClient()
  const rows: Row[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from('newsletter_subscribers')
      .select('email,status,source,created_at,unsubscribed_at')
      .order('created_at', { ascending: true })
      .range(from, from + 999)
    const page = (data ?? []) as unknown as Row[]
    rows.push(...page)
    if (page.length < 1000) break
  }

  const lines = [
    'email,status,subscribed,unsubscribed,source',
    ...rows.map((r) => [r.email, r.status, r.created_at, r.unsubscribed_at ?? '', r.source ?? ''].map(cell).join(',')),
  ]
  return new Response(lines.join(NEWLINE) + NEWLINE, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="subscribers.csv"',
      'Cache-Control': 'no-store',
    },
  })
}
