import { ImageResponse } from 'next/og'
import { isAccent, normaliseHex, paletteFor } from '@/lib/accent'
import { coverSvg, isCoverStyle } from '@/lib/cover'
import { svgDataUri } from '@/lib/og'
import { slugify } from '@/lib/utils'

// A cover's generated artwork as a PNG, for newsletters: most email programs don't show SVG.
// It only draws from the settings in the address (seed, design, colour), so it shows nothing private,
// and the same address always gives the same picture.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const seed = slugify(params.get('seed') ?? '') || 'newsletter'
  const styleInput = params.get('style')
  const style = isCoverStyle(styleInput) ? styleInput : null
  const accentInput = params.get('accent') ?? ''
  const accent = isAccent(accentInput) ? accentInput : normaliseHex(accentInput) || null
  const art = svgDataUri(coverSvg(seed, paletteFor(accent, seed), style))

  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={art} width={1200} height={800} alt="" style={{ width: 1200, height: 800 }} />
      </div>
    ),
    { width: 1200, height: 800, headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } }
  )
}
