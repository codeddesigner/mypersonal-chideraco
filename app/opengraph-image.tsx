import { ImageResponse } from 'next/og'
import { ACCENTS, INK, PAPER } from '@/lib/accent'
import { cardFonts } from '@/lib/og'
import { site } from '@/lib/site'

export const alt = `${site.brand}, articles by ${site.author}`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  const line = 'Articles on business, finance, society, religion, relationships and love.'
  const byline = `Words by ${site.author}`.toUpperCase()
  const fonts = await cardFonts(`${site.brand}${line}`, byline)
  const bands = [ACCENTS.pool.base, ACCENTS.saffron.base, ACCENTS.blush.base, ACCENTS.leaf.base, ACCENTS.iris.base]

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: PAPER, color: INK }}>
        {/* The name, as wide as the panel under it. */}
        <div style={{ display: 'flex', fontFamily: 'Newsreader', fontSize: 184, letterSpacing: -8.8, lineHeight: 1, padding: '44px 56px 0' }}>{site.brand}</div>
        <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'space-between', background: ACCENTS.lemon.base, margin: '-29px 40px 0', padding: '40px 48px 36px' }}>
          <div style={{ display: 'flex', fontFamily: 'Newsreader', fontSize: 50, lineHeight: 1.08, letterSpacing: -1.2, maxWidth: 900 }}>{line}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'Geist', fontSize: 19, letterSpacing: 2 }}>{byline}</span>
            <div style={{ display: 'flex', gap: 10 }}>
              {bands.map((color) => (
                <div key={color} style={{ width: 34, height: 34, borderRadius: 34, background: color, border: `2px solid ${INK}` }} />
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', height: 40 }} />
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined }
  )
}
