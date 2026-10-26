'use client'

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { hexToHsl, hslToHex, normaliseHex } from '@/lib/accent'

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

// A colour wheel: around the circle picks the colour, from the middle to the edge picks how strong it is,
// and the slider underneath makes it lighter or darker. A colour code can be typed instead.
export default function ColorWheel({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const wheel = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const current = value ? hexToHsl(value) : null
  // Hue and strength are remembered separately, so a grey or a very light or dark shade keeps them.
  const [hue, setHue] = useState(current?.h ?? 210)
  const [sat, setSat] = useState(current?.s ?? 70)
  const [light, setLight] = useState(current ? clamp(current.l, 4, 96) : 70)
  const [typed, setTyped] = useState(value)

  useEffect(() => {
    setTyped(value)
    if (!value) return
    const hsl = hexToHsl(value)
    if (hsl.s > 1 && hsl.l > 1 && hsl.l < 99) setHue(hsl.h)
    if (hsl.l > 1 && hsl.l < 99) setSat(hsl.s)
    setLight(clamp(hsl.l, 4, 96))
  }, [value])

  function emit(h: number, s: number, l: number) {
    const next = { h: (h + 360) % 360, s: clamp(s, 0, 100), l: clamp(l, 4, 96) }
    setHue(next.h)
    setSat(next.s)
    setLight(next.l)
    onChange(hslToHex(next))
  }

  function fromPointer(event: PointerEvent<HTMLDivElement>) {
    const box = wheel.current?.getBoundingClientRect()
    if (!box) return
    const dx = event.clientX - (box.left + box.width / 2)
    const dy = event.clientY - (box.top + box.height / 2)
    const h = (Math.atan2(dx, -dy) * 180) / Math.PI
    emit(h, Math.min(1, Math.hypot(dx, dy) / (box.width / 2)) * 100, light)
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 15 : 5
    const moves: Record<string, [number, number]> = {
      ArrowRight: [step, 0],
      ArrowLeft: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    emit(hue + move[0], sat + move[1], light)
  }

  function commitTyped() {
    const hex = normaliseHex(typed)
    if (!hex) {
      setTyped(value)
      return
    }
    onChange(hex)
  }

  const angle = (hue - 90) * (Math.PI / 180)
  const radius = sat / 100
  const marker = { left: `${50 + Math.cos(angle) * radius * 50}%`, top: `${50 + Math.sin(angle) * radius * 50}%` }
  const vars = {
    '--l': `${light}%`,
    '--track': `linear-gradient(to right, hsl(${hue} ${sat}% 4%), hsl(${hue} ${sat}% 50%), hsl(${hue} ${sat}% 96%))`,
  } as CSSProperties

  return (
    <div className="wheel-picker" style={vars}>
      <div
        ref={wheel}
        className="wheel"
        role="slider"
        tabIndex={0}
        aria-label="Colour wheel. Left and right change the colour, up and down make it stronger or softer."
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hue)}
        aria-valuetext={value || 'No colour chosen'}
        onPointerDown={(event) => {
          dragging.current = true
          event.currentTarget.setPointerCapture(event.pointerId)
          fromPointer(event)
        }}
        onPointerMove={(event) => {
          if (dragging.current) fromPointer(event)
        }}
        onPointerUp={() => {
          dragging.current = false
        }}
        onKeyDown={onKeyDown}
      >
        {value && <span className="wheel-marker" style={{ ...marker, background: value }} aria-hidden="true" />}
      </div>
      <div className="wheel-side">
        <span className="wheel-chip" style={{ background: value || 'transparent' }} aria-hidden="true" />
        <label className="wheel-hex">
          <span className="sr-only">Colour code</span>
          <input
            className="input"
            value={typed}
            placeholder="#f5c845"
            maxLength={7}
            spellCheck={false}
            onChange={(event) => setTyped(event.target.value)}
            onBlur={commitTyped}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitTyped()
              }
            }}
          />
        </label>
      </div>
      <label className="wheel-light">
        <span className="hint">Darker</span>
        <input
          type="range"
          min={4}
          max={96}
          step={1}
          value={Math.round(light)}
          aria-label="Lighter or darker"
          onChange={(event) => emit(hue, sat, Number(event.target.value))}
        />
        <span className="hint">Lighter</span>
      </label>
    </div>
  )
}
