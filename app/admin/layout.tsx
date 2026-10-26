import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import AdminNav from '@/components/AdminNav'
import { requireAdmin } from '@/lib/auth'

export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } }

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin()
  return (
    <div className="container admin">
      <AdminNav />
      {children}
    </div>
  )
}
