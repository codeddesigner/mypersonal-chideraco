import type { Metadata } from 'next'
import PlayView from '@/components/PlayView'
import { pageMetadata } from '@/lib/seo'
import './play.css'

export const metadata: Metadata = pageMetadata({
  title: 'Tiny games',
  description: 'Basketball, archery, tennis, a picture puzzle and a car race: tiny games for a short break between articles.',
  path: '/play',
})

// The games page opens on basketball; the others live at /play/<game> (app/play/[game]).
export default function PlayPage() {
  return <PlayView id="hoops" />
}
