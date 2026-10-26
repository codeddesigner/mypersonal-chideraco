import type { ReactNode } from 'react'

// Hand-drawn marks used sparingly: a loop around the byline and a squiggle under the main link.

export function Circled({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`circled ${className}`.trim()}>
      {children}
      <svg className="circled-loop" viewBox="0 0 220 64" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path
          pathLength={1}
          d="M128 5C78 2 26 9 10 27c-13 15 11 31 62 34 52 3 118-3 137-22 14-14-6-30-55-34-31-2-64 0-90 6"
        />
      </svg>
    </span>
  )
}

export function Squiggle({ children }: { children: ReactNode }) {
  return <span className="squiggle">{children}</span>
}
