import { ImageResponse } from 'next/og'
import sharp from 'sharp'
import { ACCENTS, INK, PAPER } from '@/lib/accent'
import { heroLineEms, heroLines, heroPhoto, portrait } from '@/lib/content'
import { googleFont, siteFile } from '@/lib/og'
import { SHARE_IMAGE_ALT } from '@/lib/seo'
import { createPublicClient } from '@/lib/supabase/server'
import type { Settings } from '@/lib/types'

// The picture shown when a page of the site is shared (articles have their own): the home page's opening
// section, redrawn at 1200 × 630 from the words and pictures set in Admin → Site content. Saving there
// refreshes it along with the rest of the site. Pages name it through pageMetadata (lib/seo.ts).
export const alt = SHARE_IMAGE_ALT
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const revalidate = 3600

const PANEL = '#E3E4DF' // the section's grey ([data-accent='ash'] in globals.css)
const DEEP = '#8B928C' // behind the photo, as on the page
const MARKER = ACCENTS.saffron.base // the highlighter (--marker)

// Layout, in pixels. The heading and buttons are centred on CENTRE, between the drawing's card in the
// bottom-left corner and the photo on the right.
const EDGE = 28
const PHOTO = { width: 320, height: 400 }
const CARD = { width: 196, height: 245 }
const GAP = 36 // the least room between the heading (or its arrow) and the photo
const CENTRE = 470
const MAX_SIZE = 56

// The heading face (Chidera SPAR), in ems of the heading size. A highlighter box is the face's full height
// (ascent 0.95 + descent 0.25) and lines are set 1.02 apart, so each box overlaps the next a little, as on
// the page. The arrow and buttons keep their size relative to the heading as seen on a laptop screen.
const LINE = 1.02
const BOX = 1.2002
const RISE = (BOX - LINE) / 2 // how far a box starts above its line
const ARROW = { width: 1.5, height: 0.69, gap: 0.2, top: 0.3002 } // top: below the box's top edge
const BUTTON = { height: 0.9022, padX: 0.4296, padBottom: 0.0215, border: 0.0322, font: 0.3007, gap: 0.2148, above: 0.8592 }

type Picture = { uri: string; width: number; height: number }

const dataUri = (type: string, bytes: Buffer) => `data:${type};base64,${bytes.toString('base64')}`

// The photo cropped to its frame the way the page crops it (centred across, 30% down), as a JPEG:
// the renderer can't read WebP, which is what the site's photo is.
async function framedPhoto(src: string, width: number, height: number): Promise<string | null> {
  const file = await siteFile(src)
  if (!file) return null
  try {
    const upright = await sharp(Buffer.from(file)).rotate().toBuffer()
    const { width: w = 0, height: h = 0 } = await sharp(upright).metadata()
    if (!w || !h) return null
    const scale = Math.max(width / w, height / h)
    const sw = Math.ceil(w * scale)
    const sh = Math.ceil(h * scale)
    const jpeg = await sharp(upright)
      .resize(sw, sh)
      .extract({ left: Math.floor((sw - width) / 2), top: Math.floor((sh - height) * 0.3), width, height })
      .jpeg({ quality: 85 })
      .toBuffer()
    return dataUri('image/jpeg', jpeg)
  } catch {
    return null
  }
}

// The drawing on the yellow card: an SVG goes in as it is, anything else as a PNG.
async function cardDrawing(src: string): Promise<Picture | null> {
  const file = await siteFile(src)
  if (!file) return null
  try {
    const bytes = Buffer.from(file)
    const meta = await sharp(bytes).metadata()
    if (!meta.width || !meta.height) return null
    if (meta.format === 'svg') return { uri: dataUri('image/svg+xml', bytes), width: meta.width, height: meta.height }
    const png = await sharp(bytes).rotate().resize({ height: 600, withoutEnlargement: true }).png().toBuffer({ resolveWithObject: true })
    return { uri: dataUri('image/png', png.data), width: png.info.width, height: png.info.height }
  } catch {
    return null
  }
}

export default async function Image() {
  const { data } = await createPublicClient()
    .from('site_settings')
    .select('hero_lines,hero_photo_url,hero_photo_alt,portrait_url,portrait_alt')
    .eq('id', true)
    .maybeSingle()
  const settings = (data ?? {}) as unknown as Settings
  const lines = heroLines(settings)
  const last = lines.length - 1

  // The largest size (up to MAX_SIZE) at which every line stays clear of the photo and the left edge;
  // the arrow hangs past the end of the last line. Long headings with several lines also fit the height.
  const roomLeft = CENTRE - EDGE
  const roomRight = size.width - EDGE - PHOTO.width - GAP - CENTRE
  const fits = heroLineEms(lines).map((w, i) => Math.min(roomLeft / (w / 2), roomRight / (w / 2 + (i === last ? ARROW.gap + ARROW.width : 0))))
  const F = Math.min(MAX_SIZE, 510 / (lines.length * LINE + BUTTON.above + BUTTON.height), ...fits)

  const [spar, geist, photo, drawing] = await Promise.all([
    siteFile('/fonts/ChideraSpar-Regular.woff', 'app/fonts/ChideraSpar-Regular.woff'),
    googleFont('Geist', 500, 'Book a meetingSubscribe'),
    framedPhoto(heroPhoto(settings).src, PHOTO.width * 2, PHOTO.height * 2),
    cardDrawing(portrait(settings).src),
  ])
  // Without the heading face, Newsreader stands in (the site's own fallback).
  const heading = spar ?? (await googleFont('Newsreader', 400, lines.join('')))
  const fonts = [
    ...(heading ? [{ name: 'Heading', data: heading, weight: 400 as const, style: 'normal' as const }] : []),
    ...(geist ? [{ name: 'Geist', data: geist, weight: 500 as const, style: 'normal' as const }] : []),
  ]
  const drawingHeight = CARD.height * 0.94

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: PANEL, color: INK }}>
        {/* The heading and buttons. */}
        <div
          style={{
            position: 'absolute',
            left: CENTRE - size.width / 2,
            top: 0,
            width: size.width,
            height: size.height,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: 'Heading', fontSize: F, letterSpacing: -0.025 * F }}>
            {lines.map((line, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', height: LINE * F }}>
                <div style={{ display: 'flex', background: MARKER, lineHeight: BOX, padding: `0 ${0.1 * F}px ${0.02 * F}px`, marginTop: -RISE * F }}>{line}</div>
                {i === last && (
                  <svg
                    width={ARROW.width * F}
                    height={ARROW.height * F}
                    viewBox="0 0 140 64"
                    fill="none"
                    stroke={INK}
                    strokeWidth={2.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ marginLeft: ARROW.gap * F, marginRight: -(ARROW.gap + ARROW.width) * F, marginTop: (ARROW.top - RISE) * F }}
                  >
                    <path d="M6 22C34 6 66 4 74 22c7 16-14 26-20 14-7-14 28-16 50-2 10 7 18 14 24 22" />
                    <path d="M113 51l15 5.5-1-15.5" />
                  </svg>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: BUTTON.gap * F, marginTop: BUTTON.above * F, fontFamily: 'Geist', fontSize: BUTTON.font * F, lineHeight: 1 }}>
            {['Book a meeting', 'Subscribe'].map((label, i) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: BUTTON.height * F,
                  padding: `0 ${BUTTON.padX * F}px ${BUTTON.padBottom * F}px`,
                  borderRadius: 999,
                  border: `${BUTTON.border * F}px solid ${INK}`,
                  background: i === 0 ? INK : 'transparent',
                  color: i === 0 ? PAPER : INK,
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* The photo on the right. */}
        <div
          style={{
            position: 'absolute',
            right: EDGE,
            top: (size.height - PHOTO.height) / 2,
            width: PHOTO.width,
            height: PHOTO.height,
            display: 'flex',
            overflow: 'hidden',
            background: DEEP,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {photo && <img src={photo} width={PHOTO.width} height={PHOTO.height} alt="" />}
        </div>

        {/* The drawing on its yellow card, standing in the bottom-left corner. */}
        <div
          style={{
            position: 'absolute',
            left: EDGE,
            bottom: 0,
            width: CARD.width,
            height: CARD.height,
            display: 'flex',
            overflow: 'hidden',
            background: MARKER,
          }}
        >
          {drawing && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={drawing.uri}
              width={(drawingHeight * drawing.width) / drawing.height}
              height={drawingHeight}
              alt=""
              style={{ position: 'absolute', right: 0, bottom: 0 }}
            />
          )}
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined }
  )
}
