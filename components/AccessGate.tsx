'use client'

import { useActionState, useRef, useState, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from 'react'
import { unlockPersonal, type GateState } from '@/app/about/actions'

const LENGTH = 5
const lettersOnly = (value: string) => value.replace(/[^A-Za-z]/g, '').toUpperCase()

// Five boxes, one letter each. Typing moves along, Backspace moves back, and pasting a whole code fills them all.
export default function AccessGate() {
  const [state, action, pending] = useActionState<GateState, FormData>(unlockPersonal, null)
  const [letters, setLetters] = useState<string[]>(() => Array.from({ length: LENGTH }, () => ''))
  const boxes = useRef<(HTMLInputElement | null)[]>([])
  const code = letters.join('')

  function fill(from: number, text: string) {
    const clean = lettersOnly(text)
    if (!clean) return
    setLetters((current) => {
      const next = [...current]
      for (let k = 0; k < clean.length && from + k < LENGTH; k++) next[from + k] = clean.charAt(k)
      return next
    })
    boxes.current[Math.min(from + clean.length, LENGTH - 1)]?.focus()
  }

  function clear(index: number) {
    setLetters((current) => current.map((letter, i) => (i === index ? '' : letter)))
  }

  function onChange(event: ChangeEvent<HTMLInputElement>, index: number) {
    const value = event.target.value
    const previous = letters[index]
    // A box that already holds a letter receives the old letter plus the new one; keep the new one.
    const typed = previous && value.length > 1 ? value.replace(previous, '') : value
    if (!lettersOnly(typed)) clear(index)
    else fill(index, typed)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key === 'Backspace' && !letters[index] && index > 0) {
      event.preventDefault()
      clear(index - 1)
      boxes.current[index - 1]?.focus()
    } else if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault()
      boxes.current[index - 1]?.focus()
    } else if (event.key === 'ArrowRight' && index < LENGTH - 1) {
      event.preventDefault()
      boxes.current[index + 1]?.focus()
    }
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>, index: number) {
    event.preventDefault()
    fill(index, event.clipboardData.getData('text'))
  }

  return (
    <form action={action} className="gate-form">
      <input type="hidden" name="code" value={code} />
      <div className="code-boxes" role="group" aria-label="Access code">
        {letters.map((letter, index) => (
          <input
            key={index}
            ref={(element) => {
              boxes.current[index] = element
            }}
            className="code-box"
            value={letter}
            onChange={(event) => onChange(event, index)}
            onKeyDown={(event) => onKeyDown(event, index)}
            onPaste={(event) => onPaste(event, index)}
            onFocus={(event) => event.currentTarget.select()}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            maxLength={LENGTH}
            aria-label={`Letter ${index + 1} of ${LENGTH}`}
            data-autofocus={index === 0 ? '' : undefined}
          />
        ))}
      </div>
      <button type="submit" className="btn" disabled={pending || code.length < LENGTH}>
        {pending ? 'Checking…' : 'Unlock'}
      </button>
      {state?.error && (
        <p className="notice error about-gate-error" role="alert">
          {state.error}
        </p>
      )}
    </form>
  )
}
