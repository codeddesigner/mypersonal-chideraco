import Link from 'next/link'
import Arcade from '@/components/Arcade'
import GamePicker from '@/components/GamePicker'
import type { GameId } from '@/lib/games'

// The Play pages (app/play): a row of tiny games to pick from, and the one picked.
// Offered by the bar pinned to the bottom of the other pages (components/GameNudge.tsx).
export default function PlayView({ id }: { id: GameId }) {
  return (
    <div className="page play">
      <header className="page-head">
        <h1 className="page-title">Tiny games</h1>
        <p className="page-sub">A few little games for a short break between articles. Your best scores stay on this device.</p>
      </header>
      <GamePicker id={id} />
      <Arcade key={id} id={id} />
      <p className="play-back">
        <Link href="/articles" className="text-link">
          Back to the articles
        </Link>
      </p>
    </div>
  )
}
