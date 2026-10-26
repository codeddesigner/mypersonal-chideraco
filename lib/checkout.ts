// The payment link from Admin → Settings, ready to send a reader to.
// Stripe payment links accept the email up front, so the reader doesn't type it twice.
export function paymentLink(url: string | null | undefined, email: string): string | null {
  if (!url) return null
  try {
    const link = new URL(url)
    if (link.protocol !== 'https:') return null
    if (email && link.hostname.endsWith('stripe.com') && !link.searchParams.has('prefilled_email')) {
      link.searchParams.set('prefilled_email', email)
    }
    return link.toString()
  } catch {
    return null
  }
}
