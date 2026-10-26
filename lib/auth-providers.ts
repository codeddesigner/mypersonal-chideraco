import { SUPABASE_KEY, SUPABASE_URL } from '@/lib/site'

// Whether "Continue with Google" is switched on in Supabase (Authentication → Sign In / Providers).
// The button only shows once it is, so visitors never meet a button that doesn't work. Checked every few minutes.
export async function googleEnabled(): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_KEY }, next: { revalidate: 300 } })
    if (!res.ok) return false
    const data = (await res.json()) as { external?: Record<string, boolean> }
    return data.external?.google === true
  } catch {
    return false
  }
}
