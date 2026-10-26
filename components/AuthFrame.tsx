import type { ReactNode } from 'react'
import type { AccentKey } from '@/lib/accent'
import { coverSvg } from '@/lib/cover'

// Two-panel layout for sign-in, sign-up and subscription pages.
export default function AuthFrame({
  children,
  accent = 'iris',
  seed = 'reader',
  line = 'Articles on business, finance, society, religion and love.',
}: {
  children: ReactNode
  accent?: AccentKey
  seed?: string
  line?: string
}) {
  return (
    <div className="auth">
      <div className="auth-art panel-accent" data-accent={accent} aria-hidden="true">
        <div className="auth-art-image" dangerouslySetInnerHTML={{ __html: coverSvg(seed, accent) }} />
        <p className="auth-art-line">{line}</p>
      </div>
      <div className="auth-main">{children}</div>
    </div>
  )
}
