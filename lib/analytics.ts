import type { ServerClient } from '@/lib/supabase/server'

export const EVENT_NAMES = [
  'article_viewed',
  'read_more_clicked',
  'signup_initiated',
  'account_created',
  'signin_completed',
  'subscription_initiated',
  'subscription_completed',
  'search_performed',
  'topic_selected',
] as const

export type EventName = (typeof EVENT_NAMES)[number]

export const EVENT_LABELS: Record<EventName, string> = {
  article_viewed: 'Article views',
  read_more_clicked: 'Read-more clicks',
  signup_initiated: 'Sign-ups started',
  account_created: 'Accounts created',
  signin_completed: 'Sign-ins',
  subscription_initiated: 'Subscriptions started',
  subscription_completed: 'Subscriptions completed',
  search_performed: 'Searches',
  topic_selected: 'Topic selections',
}

export type TrackedEvent = {
  name: EventName
  user_id?: string | null
  article_id?: string | null
  path?: string | null
  topic?: string | null
  query?: string | null
}

// Analytics must never break a request.
export async function track(supabase: ServerClient, event: TrackedEvent) {
  try {
    await supabase.from('events').insert({
      name: event.name,
      user_id: event.user_id ?? null,
      article_id: event.article_id ?? null,
      path: event.path?.slice(0, 300) ?? null,
      topic: event.topic?.slice(0, 100) ?? null,
      query: event.query?.slice(0, 200) ?? null,
    })
  } catch {
    // ignore
  }
}
