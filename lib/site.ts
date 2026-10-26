function siteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL
  if (explicit) return explicit.endsWith('/') ? explicit.slice(0, -1) : explicit
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (vercel) return `https://${vercel}`
  return 'http://localhost:3000'
}

export const site = {
  name: 'chidera.co',
  brand: 'Chidera’s Note',
  author: 'Chidera Nwanyemike',
  role: 'Brand & Storytelling Strategist',
  description:
    'Articles and perspectives by Chidera Nwanyemike on business, finance, society, religion, relationships, love and the things that shape how we think and live.',
  url: siteUrl(),
}

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ''
