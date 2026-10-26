import { getProfile, getUser } from '@/lib/auth'
import SiteNav from './SiteNav'

export default async function Navbar() {
  const user = await getUser()
  const profile = user ? await getProfile() : null

  const links = [
    { href: '/articles', label: 'Articles' },
    { href: '/topics', label: 'Topics' },
    { href: '/about', label: 'About me' },
    { href: '/subscribe', label: 'Subscribe' },
    ...(profile?.role === 'admin' ? [{ href: '/admin', label: 'Admin' }] : []),
  ]
  const account = user ? { href: '/account', label: 'Your account' } : { href: '/login', label: 'Sign in' }

  return <SiteNav links={links} account={account} />
}
