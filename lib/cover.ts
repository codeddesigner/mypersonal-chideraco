import { ACCENTS, INK, PAPER, hashString, hexToHsl, hslToHex, readability, type AccentKey, type Palette } from './accent'

// Geometric cover art, drawn from the essay's slug, colour and chosen design.
// Used wherever an essay has no uploaded cover image.

function rng(seed: number) {
  let a = seed || 1
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const W = 600
const H = 400
const n = (v: number) => Math.round(v * 10) / 10
const bg = (base: string) => `<rect width="${W}" height="${H}" fill="${base}"/>`

type Draw = (r: () => number, base: string, deep: string) => string

const sun: Draw = (r, base, deep) => {
  const cx = 190 + r() * 220
  const horizon = 230 + r() * 30
  const sx = cx > 300 ? 90 + r() * 80 : 430 + r() * 80
  const lines = [0, 1, 2, 3]
    .map((i) => {
      const w = 190 - i * 44
      return `<rect x="${n(cx - w / 2)}" y="${n(horizon + 26 + i * 28)}" width="${w}" height="7" rx="3.5" fill="${PAPER}" opacity="${0.85 - i * 0.15}"/>`
    })
    .join('')
  return `${bg(base)}<circle cx="${n(cx)}" cy="${n(horizon)}" r="112" fill="${INK}"/><rect y="${n(horizon)}" width="${W}" height="${n(H - horizon)}" fill="${deep}"/>${lines}<circle cx="${n(sx)}" cy="${n(70 + r() * 40)}" r="17" fill="${PAPER}"/>`
}

const arches: Draw = (r, base, deep) => {
  const cx = 210 + r() * 180
  const arch = (rad: number, h: number, fill: string) =>
    `<path d="M${n(cx - rad)} ${H}V${n(H - h)}A${rad} ${rad} 0 0 1 ${n(cx + rad)} ${n(H - h)}V${H}Z" fill="${fill}"/>`
  const bx = cx > 300 ? 80 + r() * 40 : 470 + r() * 40
  return `${bg(base)}${arch(152, 230, PAPER)}${arch(106, 180, INK)}${arch(58, 120, deep)}<circle cx="${n(bx)}" cy="${n(80 + r() * 50)}" r="26" fill="none" stroke="${INK}" stroke-width="5"/>`
}

const dots: Draw = (r, base, deep) => {
  const cols = 9
  const rows = 6
  const big = Math.floor(r() * cols * rows)
  const bx = 60 + (big % cols) * 60
  const by = 50 + Math.floor(big / cols) * 60
  let out = `${bg(base)}<circle cx="${bx}" cy="${by}" r="76" fill="${deep}"/>`
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = 60 + col * 60
      const y = 50 + row * 60
      const pick = r()
      if (pick > 0.88) out += `<circle cx="${x}" cy="${y}" r="15" fill="${PAPER}"/>`
      else if (pick > 0.8) out += `<circle cx="${x}" cy="${y}" r="15" fill="${INK}"/>`
      else out += `<circle cx="${x}" cy="${y}" r="5" fill="${INK}"/>`
    }
  }
  return out
}

const waves: Draw = (r, base, deep) => {
  const phase = r() * Math.PI * 2
  const amp = 16 + r() * 14
  const wave = (y: number, shift: number) => {
    const pts: string[] = []
    for (let x = -20; x <= W + 20; x += 12) pts.push(`${x},${n(y + Math.sin(x / 48 + phase + shift) * amp)}`)
    return pts.join(' ')
  }
  const band = r() * 3
  let out = `${bg(base)}<rect y="${n(150 + band * 30)}" width="${W}" height="120" fill="${deep}"/>`
  for (let i = 0; i < 6; i++) {
    const y = 60 + i * 56
    const paper = i === 2 + Math.floor(band)
    out += `<polyline points="${wave(y, i * 0.6)}" fill="none" stroke="${paper ? PAPER : INK}" stroke-width="${paper ? 14 : 6}" stroke-linecap="round" stroke-linejoin="round"/>`
  }
  return out
}

const split: Draw = (r, base, deep) => {
  const cx = 250 + r() * 100
  const cy = 200
  const rad = 128
  const dy = 22
  const sq = 70 + r() * 30
  return `${bg(base)}<rect x="${n(cx - 230)}" y="${n(cy + 40)}" width="${n(sq)}" height="${n(sq)}" fill="${deep}" transform="rotate(-12 ${n(cx - 230 + sq / 2)} ${n(cy + 40 + sq / 2)})"/><path d="M${n(cx)} ${n(cy - rad - dy)}A${rad} ${rad} 0 0 0 ${n(cx)} ${n(cy + rad - dy)}Z" fill="${INK}"/><path d="M${n(cx + 10)} ${n(cy - rad + dy)}A${rad} ${rad} 0 0 1 ${n(cx + 10)} ${n(cy + rad + dy)}Z" fill="${PAPER}"/><circle cx="${n(cx + 205)}" cy="${n(cy - 120)}" r="20" fill="none" stroke="${INK}" stroke-width="5"/>`
}

const pages: Draw = (r, base, deep) => {
  const cx = 300
  const cy = 210
  const page = (angle: number, fill: string, lines: boolean) => {
    let s = `<g transform="rotate(${angle} ${cx} ${cy})"><rect x="${cx - 112}" y="${cy - 150}" width="224" height="300" rx="6" fill="${fill}" stroke="${INK}" stroke-width="3"/>`
    if (lines) {
      for (let i = 0; i < 9; i++) {
        const w = i === 0 ? 120 : 150 - (i % 3) * 22
        s += `<rect x="${cx - 80}" y="${cy - 110 + i * 26}" width="${w}" height="${i === 0 ? 12 : 6}" rx="3" fill="${INK}"/>`
      }
    }
    return s + '</g>'
  }
  const tilt = (r() - 0.5) * 6
  return `${bg(base)}${page(-14 + tilt, deep, false)}${page(-4 + tilt, PAPER, false)}${page(6 + tilt, PAPER, true)}`
}

const bars: Draw = (r, base, deep) => {
  let out = `${bg(base)}<circle cx="${n(120 + r() * 360)}" cy="88" r="38" fill="${PAPER}"/>`
  const fills = [INK, deep, PAPER]
  for (let i = 0; i < 9; i++) {
    const h = 70 + r() * 200
    const x = 52 + i * 56
    out += `<rect x="${x}" y="${n(330 - h)}" width="40" height="${n(h)}" fill="${fills[(i + Math.floor(r() * 3)) % 3]}"/>`
  }
  return out + `<rect y="330" width="${W}" height="${H - 330}" fill="${INK}"/>`
}

// Concentric rings, slightly off centre, with a tilted square for balance.
const rings: Draw = (r, base, deep) => {
  const cx = 210 + r() * 180
  const cy = 205 + (r() - 0.5) * 30
  const fills = [deep, PAPER, INK, base, PAPER]
  let out = bg(base)
  ;[176, 136, 98, 62, 28].forEach((rad, i) => {
    out += `<circle cx="${n(cx)}" cy="${n(cy)}" r="${rad}" fill="${fills[i]}"/>`
  })
  const sx = cx > 300 ? 56 + r() * 30 : 488 + r() * 30
  const sy = 56 + r() * 60
  out += `<rect x="${n(sx)}" y="${n(sy)}" width="54" height="54" fill="${INK}" transform="rotate(${n(10 + r() * 25)} ${n(sx + 27)} ${n(sy + 27)})"/>`
  return out
}

// A staircase of blocks climbing towards a low sun.
const steps: Draw = (r, base, deep) => {
  const rising = r() > 0.5
  const sunX = rising ? 470 + r() * 50 : 80 + r() * 50
  let out = `${bg(base)}<circle cx="${n(sunX)}" cy="${n(120 + r() * 30)}" r="70" fill="${INK}"/>`
  for (let i = 0; i < 6; i++) {
    const h = 70 + i * 52
    const x = rising ? i * 100 : W - (i + 1) * 100
    out += `<rect x="${x}" y="${H - h}" width="100" height="${h}" fill="${deep}"/><rect x="${x}" y="${H - h}" width="100" height="10" fill="${PAPER}"/>`
  }
  return out
}

// A grid of square tiles, each with a quarter circle in one corner.
const tiles: Draw = (r, base, deep) => {
  const S = 100
  const colours = [base, base, base, deep, deep, INK, PAPER]
  let out = bg(base)
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 6; col++) {
      const x = col * S
      const y = row * S
      const back = colours[Math.floor(r() * colours.length)]
      const options = [deep, INK, PAPER, base].filter((c) => c !== back)
      const front = options[Math.floor(r() * options.length)]
      const corner = Math.floor(r() * 4)
      const d = [
        `M${x} ${y}H${x + S}A${S} ${S} 0 0 1 ${x} ${y + S}Z`,
        `M${x + S} ${y}V${y + S}A${S} ${S} 0 0 1 ${x} ${y}Z`,
        `M${x + S} ${y + S}H${x}A${S} ${S} 0 0 1 ${x + S} ${y}Z`,
        `M${x} ${y + S}V${y}A${S} ${S} 0 0 1 ${x + S} ${y + S}Z`,
      ][corner]
      out += `<rect x="${x}" y="${y}" width="${S}" height="${S}" fill="${back}"/><path d="${d}" fill="${front}"/>`
    }
  }
  return out
}

// Two ranges of peaks under a pale sun.
const peaks: Draw = (r, base, deep) => {
  const back = `0,${H} 0,${n(250 + r() * 30)} ${n(100 + r() * 30)},${n(140 + r() * 40)} 230,250 ${n(350 + r() * 40)},${n(110 + r() * 40)} 480,240 ${W},${n(160 + r() * 30)} ${W},${H}`
  const front = `0,${H} 0,320 ${n(150 + r() * 40)},${n(210 + r() * 30)} 300,330 ${n(420 + r() * 40)},${n(225 + r() * 30)} ${W},320 ${W},${H}`
  return `${bg(base)}<circle cx="${n(150 + r() * 300)}" cy="92" r="44" fill="${PAPER}"/><polygon points="${back}" fill="${deep}"/><polygon points="${front}" fill="${INK}"/>`
}

// Diagonal stripes behind a large ringed circle.
const stripes: Draw = (r, base, deep) => {
  let out = bg(base)
  for (let i = -1; i < 17; i++) {
    const x = i * 56
    out += `<line x1="${x}" y1="-10" x2="${x - 260}" y2="${H + 10}" stroke="${deep}" stroke-width="18"/>`
  }
  const cx = 220 + r() * 160
  const cy = 190 + (r() - 0.5) * 40
  out += `<circle cx="${n(cx)}" cy="${n(cy)}" r="118" fill="${PAPER}" stroke="${INK}" stroke-width="6"/>`
  out += `<circle cx="${n(cx + 40 - r() * 80)}" cy="${n(cy + 30)}" r="30" fill="${INK}"/>`
  return out
}

// A planet on a tilted orbit, with two moons and a scatter of stars.
const orbit: Draw = (r, base, deep) => {
  const cx = 280 + r() * 40
  const cy = 200
  const rx = 240
  const ry = 82
  const tilt = (-14 - r() * 10) * (Math.PI / 180)
  const at = (t: number) => {
    const x = rx * Math.cos(t)
    const y = ry * Math.sin(t)
    return [n(cx + x * Math.cos(tilt) - y * Math.sin(tilt)), n(cy + x * Math.sin(tilt) + y * Math.cos(tilt))]
  }
  const t1 = r() * Math.PI * 2
  const [m1x, m1y] = at(t1)
  const [m2x, m2y] = at(t1 + 2.6)
  let out = bg(base)
  for (let i = 0; i < 14; i++) out += `<circle cx="${n(r() * W)}" cy="${n(r() * H)}" r="3" fill="${PAPER}"/>`
  out += `<circle cx="${n(cx)}" cy="${cy}" r="92" fill="${INK}"/>`
  out += `<ellipse cx="${n(cx)}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${INK}" stroke-width="4" transform="rotate(${n((tilt * 180) / Math.PI)} ${n(cx)} ${cy})"/>`
  out += `<circle cx="${m1x}" cy="${m1y}" r="24" fill="${PAPER}" stroke="${INK}" stroke-width="4"/><circle cx="${m2x}" cy="${m2y}" r="15" fill="${deep}" stroke="${INK}" stroke-width="4"/>`
  return out
}

const MOTIFS: Record<string, Draw> = { sun, arches, dots, waves, split, pages, bars, rings, steps, tiles, peaks, stripes, orbit }

// The designs offered in the article editor, in order.
export const COVER_STYLES = [
  { id: 'sun', name: 'Sun' },
  { id: 'arches', name: 'Arches' },
  { id: 'dots', name: 'Dots' },
  { id: 'waves', name: 'Waves' },
  { id: 'split', name: 'Split' },
  { id: 'pages', name: 'Pages' },
  { id: 'bars', name: 'Bars' },
  { id: 'rings', name: 'Rings' },
  { id: 'steps', name: 'Steps' },
  { id: 'tiles', name: 'Tiles' },
  { id: 'peaks', name: 'Peaks' },
  { id: 'stripes', name: 'Stripes' },
  { id: 'orbit', name: 'Orbit' },
] as const

export function isCoverStyle(value: unknown): value is string {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(MOTIFS, value)
}

// Without a chosen design, one of the first seven is picked from the slug, so older covers stay as they were.
const AUTOMATIC = ['sun', 'arches', 'dots', 'waves', 'split', 'pages', 'bars']

export function coverStyleFor(style: string | null | undefined, seed: string): string {
  return isCoverStyle(style) ? style : AUTOMATIC[hashString(seed) % AUTOMATIC.length]
}

export function coverSvg(seed: string, colour: AccentKey | Palette, style?: string | null): string {
  const h = hashString(seed)
  const draw = MOTIFS[coverStyleFor(style, seed)]
  const { base, deep } = typeof colour === 'string' ? ACCENTS[colour] : colour
  // On a dark colour the near-black shapes would disappear, so they're drawn in a pale tint of the colour
  // instead, and the second colour is a lighter shade rather than a darker one.
  const dark = readability(INK, base) < 30
  const hsl = hexToHsl(base)
  const shade = dark ? hslToHex({ h: hsl.h, s: Math.min(hsl.s, 70), l: Math.min(hsl.l + 16, 58) }) : deep
  let art = draw(rng(h), base, shade)
  if (dark) art = art.split(INK).join(hslToHex({ h: hsl.h, s: Math.min(hsl.s, 55), l: 80 }))
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${art}</svg>`
}
