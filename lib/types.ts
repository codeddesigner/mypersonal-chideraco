export type AccessLevel = 'public' | 'members' | 'subscribers'
export type ArticleStatus = 'draft' | 'published' | 'archived'

export type Topic = { name: string; slug: string }
export type TopicWithCount = Topic & { id: string; sort_order: number; article_count: number }

export type ArticleSummary = {
  id: string
  title: string
  slug: string
  description: string
  published_at: string
  reading_minutes: number
  access: AccessLevel
  featured: boolean
  topics: Topic[]
  cover_image_url: string | null
  cover_alt: string
  accent: string | null
  cover_style: string | null
  // The colour of the text on the article's header: #rrggbb, or null for automatic (dark or white).
  text_colour: string | null
}

export type Article = ArticleSummary & {
  preview: string
  author: string
  status: ArticleStatus
  // When the article was last changed (for search engines); null if unknown.
  updated_at: string | null
}

export type Profile = {
  id: string
  email: string
  display_name: string | null
  role: 'reader' | 'admin'
  status: 'active' | 'suspended'
  created_at: string
}

export type Subscription = {
  id: string
  user_id: string
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired'
  plan: string
  started_at: string
  current_period_end: string | null
  provider: string
}

export type SocialLink = { label: string; url: string }

export type Settings = {
  subscriptions_enabled: boolean
  plan_name: string
  price_amount: number
  currency: string
  billing_interval: 'month' | 'year'
  billing_provider: string
  checkout_url: string | null
  subscribe_note: string
  about_body: string
  social_links: SocialLink[]
  // Website availability (Admin → Settings). While site_offline is on, visitors only see the notice.
  site_offline?: boolean
  offline_title?: string
  offline_note?: string
  offline_since?: string | null
  // Contact and press, all optional (Admin → Settings).
  booking_url?: string | null
  contact_email?: string | null
  press_kit_url?: string | null
  // Site copy (Admin → Site content), all optional; lib/content.ts holds the fallbacks.
  hero_lines?: string | null
  portrait_url?: string | null
  portrait_alt?: string | null
  hero_photo_url?: string | null
  hero_photo_alt?: string | null
  footer_about?: string | null
  newsletter_heading?: string | null
  subscribe_heading?: string | null
  subscribe_intro?: string | null
  subscribe_art_line?: string | null
  // About page (Admin → About page), all optional; lib/about.ts reads them safely.
  // Personal life lives in the about_private table, readable by admins or with an access code.
  about_services?: unknown
  about_experience?: unknown
  about_education?: unknown
  about_clients?: string | null
  about_photo_url?: string | null
  about_photo_alt?: string | null
  about_statement?: string | null
  about_credential?: string | null
  about_figures?: unknown
}

// A reader's comment under an article. The name is copied from their profile when they post.
export type Comment = {
  id: string
  user_id: string
  author_name: string
  by_admin: boolean
  body: string
  created_at: string
}

export type AccessCode = {
  id: string
  code: string
  label: string
  created_at: string
  expires_at: string | null
  revoked_at: string | null
  use_count: number
  last_used_at: string | null
}

export const ACCESS_LABELS: Record<AccessLevel, string> = {
  members: 'Registered readers',
  subscribers: 'Subscribers only',
  public: 'Everyone',
}
