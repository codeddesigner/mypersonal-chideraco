import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import PlayView from '@/components/PlayView'
import { GAMES, gameById } from '@/lib/games'
import { pageMetadata } from '@/lib/seo'
import '../play.css'

type Params = Promise<{ game: string }>

// Every game but basketball, which is at /play itself.
const OTHERS = GAMES.filter((game) => game.path !== '/play')

export const dynamicParams = false

export function generateStaticParams() {
  return OTHERS.map((game) => ({ game: game.id }))
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const game = gameById((await params).game)
  if (!game) return { title: 'Game not found' }
  return pageMetadata({ title: `${game.name}, a tiny game`, description: game.description, path: game.path })
}

export default async function GamePage({ params }: { params: Params }) {
  const game = gameById((await params).game)
  if (!game || game.path === '/play') notFound()
  return <PlayView id={game.id} />
}
