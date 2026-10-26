'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { GAMES, type GameId } from '@/lib/games'

// The row of tiny games on the Play pages. On a phone it scrolls sideways, so the picked game is brought into view.
export default function GamePicker({ id }: { id: GameId }) {
  const nav = useRef<HTMLElement>(null)

  useEffect(() => {
    const row = nav.current
    const current = row?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!row || !current || row.scrollWidth <= row.clientWidth) return
    row.scrollLeft = Math.max(0, current.offsetLeft - row.offsetLeft - (row.clientWidth - current.offsetWidth) / 2)
  }, [id])

  return (
    <nav className="game-picker" aria-label="Games" ref={nav}>
      {GAMES.map((game) => (
        <Link key={game.id} href={game.path} aria-current={game.id === id ? 'page' : undefined} scroll={false}>
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: game.icon }} />
          {game.name}
        </Link>
      ))}
    </nav>
  )
}
