'use client'

import { useEffect, useRef, useState } from 'react'
import { gameById, gameLabel, gameScript, type GameId } from '@/lib/games'

// One of the tiny games (lib/games.ts), on the Play pages. The games are plain browser scripts in public/games,
// fetched the first time they're needed, started once the court is on the page, and stopped when the reader
// leaves, so the arrow keys and Space work normally everywhere else.

type Start = (canvas: HTMLCanvasElement, ui: { score: HTMLElement | null }) => (() => void) | undefined

declare global {
  interface Window {
    chideraGames?: Record<string, unknown>
  }
}

const loading = new Map<string, Promise<void>>()

function load(src: string): Promise<void> {
  let promise = loading.get(src)
  if (!promise) {
    promise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = src
      script.async = false
      script.onload = () => resolve()
      script.onerror = () => {
        loading.delete(src)
        script.remove()
        reject(new Error(`Couldn't load ${src}`))
      }
      document.head.appendChild(script)
    })
    loading.set(src, promise)
  }
  return promise
}

export default function Arcade({ id }: { id: GameId }) {
  const game = gameById(id)!
  const canvas = useRef<HTMLCanvasElement>(null)
  const score = useRef<HTMLParagraphElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let stop: (() => void) | undefined
    let cancelled = false
    load(gameScript('kit'))
      .then(() => load(gameScript(id)))
      .then(() => {
        const start = window.chideraGames?.[id] as Start | undefined
        if (cancelled || !canvas.current || typeof start !== 'function') return
        stop = start(canvas.current, { score: score.current })
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      stop?.()
    }
  }, [id])

  return (
    <section className="game" aria-label={`A tiny game: ${game.name}`}>
      <canvas ref={canvas} width={600} height={450} tabIndex={0} aria-label={gameLabel(game)} aria-describedby={`${id}-how`} />
      <div className="game-foot">
        <p id={`${id}-how`}>
          {failed ? (
            'The game didn’t load. Check your connection and reload the page.'
          ) : (
            <>
              <span className="how-mouse">{game.mouse}</span>
              <span className="how-touch">{game.touch}</span>
            </>
          )}
        </p>
        {/* Filled in by the game itself. */}
        <p className="score" aria-live="polite" ref={score} />
      </div>
    </section>
  )
}
