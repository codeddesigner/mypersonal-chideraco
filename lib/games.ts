// The tiny games: basketball, archery, tennis, a sliding picture puzzle and a car race.
// The games themselves are plain browser scripts in public/games, shared by the Play pages (components/Arcade.tsx)
// and the "not available" page (lib/offline.ts), which loads them while the rest of the site is off.

export type GameId = 'hoops' | 'archery' | 'tennis' | 'puzzle' | 'racing'

export type GameInfo = {
  id: GameId
  name: string
  path: string
  // What the canvas shows, for screen readers.
  scene: string
  // How to play, with a mouse (and keyboard) and on a touch screen.
  mouse: string
  touch: string
  keys: string
  description: string
  // A small flat picture for the game picker. Ink parts use currentColor.
  icon: string
}

// Bump when the files in public/games change, so browsers fetch the new ones.
export const GAMES_VERSION = '2'

const INK = 'stroke="currentColor"'

export const GAMES: GameInfo[] = [
  {
    id: 'hoops',
    name: 'Basketball',
    path: '/play',
    scene: 'Basketball court',
    mouse: 'Point where to throw and click, or aim with the arrow keys and press Space.',
    touch: 'Pull back and let go.',
    keys: 'With a keyboard, the arrow keys aim and Space throws.',
    description: 'A tiny basketball game for a short break between articles.',
    icon: `<circle cx="12" cy="12" r="9" fill="#EE7A2F" ${INK} stroke-width="1.8"/><path d="M3 12h18M12 3v18M6.6 5.3c2.1 1.8 3.4 4.1 3.4 6.7s-1.3 4.9-3.4 6.7M17.4 5.3c-2.1 1.8-3.4 4.1-3.4 6.7s1.3 4.9 3.4 6.7" fill="none" ${INK} stroke-width="1.4"/>`,
  },
  {
    id: 'archery',
    name: 'Archery',
    path: '/play/archery',
    scene: 'Archery range',
    mouse: 'Point where to shoot and click, or aim with the arrow keys and press Space. Five arrows a round.',
    touch: 'Pull back and let go. Five arrows a round.',
    keys: 'With a keyboard, the arrow keys aim and Space shoots.',
    description: 'A tiny archery game: five arrows at a target that won’t keep still.',
    icon: `<circle cx="12" cy="12" r="9" fill="#FAFAF5" ${INK} stroke-width="1.8"/><circle cx="12" cy="12" r="5.6" fill="#D2491F" ${INK} stroke-width="1.4"/><circle cx="12" cy="12" r="2.3" fill="#F5C845"/>`,
  },
  {
    id: 'tennis',
    name: 'Tennis',
    path: '/play/tennis',
    scene: 'Tennis court',
    mouse: 'Move the mouse, or the up and down arrows, to meet the ball. First to five wins.',
    touch: 'Drag up and down to meet the ball. First to five wins.',
    keys: 'With a keyboard, the up and down arrows move and Space starts.',
    description: 'Tiny tennis against the computer, first to five points.',
    icon: `<circle cx="12" cy="12" r="9" fill="#DCEB5B" ${INK} stroke-width="1.8"/><path d="M5.4 6.4c2.9 1.9 2.9 9.3 0 11.2M18.6 6.4c-2.9 1.9-2.9 9.3 0 11.2" fill="none" ${INK} stroke-width="1.4"/>`,
  },
  {
    id: 'puzzle',
    name: 'Puzzle',
    path: '/play/puzzle',
    scene: 'Sliding picture puzzle',
    mouse: 'Click a tile, or use the arrow keys, to slide it into the gap and finish the picture.',
    touch: 'Tap a tile to slide it into the gap and finish the picture.',
    keys: 'With a keyboard, the arrow keys slide a tile into the gap.',
    description: 'A tiny sliding picture puzzle.',
    icon: `<rect x="3" y="3" width="8" height="8" rx="1.5" fill="#BFE3E8" ${INK} stroke-width="1.6"/><rect x="13" y="3" width="8" height="8" rx="1.5" fill="#F5C845" ${INK} stroke-width="1.6"/><rect x="3" y="13" width="8" height="8" rx="1.5" fill="#43BD8E" ${INK} stroke-width="1.6"/><rect x="13.8" y="13.8" width="6.4" height="6.4" rx="1" fill="none" ${INK} stroke-width="1.2" stroke-dasharray="2 2"/>`,
  },
  {
    id: 'racing',
    name: 'Racing',
    path: '/play/racing',
    scene: 'Road race',
    mouse: 'Steer with the mouse, or the up and down arrows, and keep clear of the traffic.',
    touch: 'Drag up and down to steer clear of the traffic.',
    keys: 'With a keyboard, the up and down arrows steer and Space starts.',
    description: 'A tiny car race: weave through the traffic as the road gets faster.',
    icon: `<path d="M6.5 5.5h3M14.5 5.5h3M6.5 18.5h3M14.5 18.5h3" ${INK} stroke-width="2.2" stroke-linecap="round"/><rect x="3" y="6.5" width="18" height="11" rx="3" fill="#F5C845" ${INK} stroke-width="1.6"/><rect x="13" y="9" width="3" height="6" rx="1" fill="#BFE3E8" ${INK} stroke-width="1.1"/>`,
  },
]

export function gameById(id: string): GameInfo | undefined {
  return GAMES.find((game) => game.id === id)
}

// Everything a screen reader needs to know about the game.
export function gameLabel(game: GameInfo): string {
  return `${game.scene}. With a mouse: ${game.mouse} On a touch screen: ${game.touch} ${game.keys}`
}

export function gameScript(name: GameId | 'kit'): string {
  return `/games/${name}.js?v=${GAMES_VERSION}`
}
