'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

export type AboutTab = { id: string; label: string; locked?: boolean }

function Padlock({ open }: { open: boolean }) {
  return (
    <svg className="about-tab-lock" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="10.5" width="14" height="10" rx="1.5" />
      <path d={open ? 'M8.5 10.5V7a3.5 3.5 0 0 1 6.8-1.2' : 'M8.5 10.5V7a3.5 3.5 0 0 1 7 0v3.5'} />
    </svg>
  )
}

// The three parts of the About page. All panels are rendered on the server; this only shows one at a time,
// keeps the choice in the address (?view=) and moves focus into a panel that asks for something, like a code.
export default function AboutTabs({ tabs, panels, initial }: { tabs: AboutTab[]; panels: ReactNode[]; initial: string }) {
  const [active, setActive] = useState(initial)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const chosen = useRef(false)

  function select(id: string) {
    chosen.current = true
    setActive(id)
    const url = new URL(window.location.href)
    if (id === tabs[0]?.id) url.searchParams.delete('view')
    else url.searchParams.set('view', id)
    window.history.replaceState(window.history.state, '', url.toString())
  }

  useEffect(() => {
    if (!chosen.current) return
    chosen.current = false
    const field = document.getElementById(`about-panel-${active}`)?.querySelector<HTMLElement>('[data-autofocus]')
    field?.focus({ preventScroll: true })
  }, [active])

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = tabs.length - 1
    let next = -1
    if (event.key === 'ArrowRight') next = index === last ? 0 : index + 1
    else if (event.key === 'ArrowLeft') next = index === 0 ? last : index - 1
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = last
    if (next === -1) return
    event.preventDefault()
    tabRefs.current[next]?.focus()
    select(tabs[next].id)
  }

  return (
    <div className="about-views">
      <div className="about-tabs" role="tablist" aria-label="About">
        {tabs.map((tab, index) => {
          const selected = tab.id === active
          return (
            <button
              key={tab.id}
              ref={(element) => {
                tabRefs.current[index] = element
              }}
              type="button"
              role="tab"
              id={`about-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`about-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              className="about-tab"
              onClick={() => select(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              <span className="about-tab-label">{tab.label}</span>
              {tab.locked !== undefined && <Padlock open={!tab.locked} />}
              {tab.locked && <span className="sr-only"> (needs an access code)</span>}
            </button>
          )
        })}
      </div>
      {tabs.map((tab, index) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`about-panel-${tab.id}`}
          aria-labelledby={`about-tab-${tab.id}`}
          className="about-panel"
          hidden={tab.id !== active}
        >
          {panels[index]}
        </div>
      ))}
    </div>
  )
}
