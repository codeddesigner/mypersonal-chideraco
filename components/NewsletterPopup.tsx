import { getUser } from '@/lib/auth'
import { newsletterLines } from '@/lib/content'
import { getSettings, getSubscription, isActiveSubscription } from '@/lib/queries'
import NewsletterDialog from './NewsletterDialog'

// The sign-up pop-up on every page, with the same words as the footer sign-up (Admin → Site content).
// Readers who are signed in with a running subscription never see it.
export default async function NewsletterPopup() {
  const [user, settings] = await Promise.all([getUser(), getSettings()])
  if (user && isActiveSubscription(await getSubscription(user.id))) return null
  return (
    <NewsletterDialog
      heading={newsletterLines(settings)}
      note={settings.checkout_url ? 'You’ll pay on the next page.' : undefined}
    />
  )
}
