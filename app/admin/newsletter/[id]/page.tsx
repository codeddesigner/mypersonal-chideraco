import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import NewsletterComposer, { type ComposerNewsletter, type Failure } from '@/components/NewsletterComposer'
import { requireAdmin } from '@/lib/auth'
import { mailSettings } from '@/lib/resend'
import { site } from '@/lib/site'
import { createClient } from '@/lib/supabase/server'
import { isUuid } from '@/lib/utils'
import type { LinkedArticle, Progress } from '../../newsletter-actions'
import SetupNotice from '../SetupNotice'
import '../../editor.css'
import '../newsletter.css'

export const metadata: Metadata = { title: 'Newsletter' }

type Params = Promise<{ id: string }>
type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function NewsletterPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const admin = await requireAdmin()
  const { id } = await params
  const fromArticle = (await searchParams).from === 'article'
  if (!isUuid(id)) notFound()

  const supabase = await createClient()
  const { data } = await supabase
    .from('newsletter_campaigns')
    .select(
      'id,subject,preheader,body,status,total,sent_count,failed_count,skipped_count,test_sent_to,test_sent_at,updated_at,started_at,finished_at,article_id,cover_mode,cover_image_url,cover_alt,cover_style,accent,cover_seed'
    )
    .eq('id', id)
    .maybeSingle()
  const newsletter = data as unknown as
    | (ComposerNewsletter & { total: number; sent_count: number; failed_count: number; skipped_count: number; article_id: string | null })
    | null
  if (!newsletter) notFound()

  const sending = newsletter.status !== 'draft'
  const [active, progressResult, failedResult, articleResult] = await Promise.all([
    supabase.from('newsletter_subscribers').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    sending ? supabase.rpc('newsletter_progress', { p_campaign: id }) : Promise.resolve({ data: null }),
    sending
      ? supabase.from('newsletter_deliveries').select('email,error').eq('campaign_id', id).eq('status', 'failed').order('id').limit(200)
      : Promise.resolve({ data: [] }),
    newsletter.article_id
      ? supabase.from('articles').select('id,title,slug,access,status,published_at').eq('id', newsletter.article_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const mail = mailSettings()

  return (
    <>
      {(!mail.ready || mail.testSender) && <SetupNotice missing={mail.missing} testSender={mail.testSender} />}
      <NewsletterComposer
        newsletter={newsletter}
        activeCount={active.count ?? 0}
        progress={(progressResult.data as unknown as Progress | null) ?? null}
        failures={(failedResult.data ?? []) as unknown as Failure[]}
        article={(articleResult.data as unknown as LinkedArticle | null) ?? null}
        notice={fromArticle && newsletter.status === 'draft' ? 'Newsletter made from your article. Check it, send yourself a test, then send it.' : undefined}
        canSend={mail.ready}
        adminEmail={admin.email}
        siteUrl={site.url}
        brand={site.brand}
      />
    </>
  )
}
