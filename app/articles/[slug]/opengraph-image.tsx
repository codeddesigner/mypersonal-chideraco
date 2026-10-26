import { ImageResponse } from 'next/og'
import { hexToRgb, paletteFor, textFor } from '@/lib/accent'
import { coverSvg } from '@/lib/cover'
import { cardFonts, svgDataUri } from '@/lib/og'
import { site } from '@/lib/site'
import { createPublicClient } from '@/lib/supabase/server'
import { oneLine } from '@/lib/utils'

export const alt = site.brand
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

type Params = { slug: string } | Promise<{ slug: string }>
type Row = {
  title: string
  slug: string
  accent: string | null
  cover_style: string | null
  text_colour: string | null
  cover_image_url: string | null
  reading_minutes: number
}

export default async function Image({ params }: { params: Params }) {
  const { slug } = await params
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('articles')
    .select('title,slug,accent,cover_style,text_colour,cover_image_url,reading_minutes')
    .eq('slug', slug)
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .maybeSingle()
  const row = data as unknown as Row | null
  const title = row ? oneLine(row.title) : site.brand
  const accent = paletteFor(row?.accent, row?.slug ?? slug)
  const ink = textFor(accent.base, row?.text_colour)
  const rule = `rgba(${hexToRgb(ink).join(', ')}, 0.3)`
  const art = row?.cover_image_url || svgDataUri(coverSvg(row?.slug ?? slug, accent, row?.cover_style))
  const byline = `Words by ${site.author}`.toUpperCase()
  const minutes = row ? `${row.reading_minutes} min read`.toUpperCase() : ''
  const fonts = await cardFonts(`${site.brand}${title}`, `${byline}${minutes}`)

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: accent.base, color: ink, padding: 64, gap: 56 }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1 }}>
          <div style={{ fontFamily: 'Newsreader', fontSize: 40, letterSpacing: -1 }}>{site.brand}</div>
          <div style={{ display: 'flex', fontFamily: 'Newsreader', fontSize: title.length > 56 ? 54 : 66, lineHeight: 1.04, letterSpacing: -2 }}>{title}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Geist', fontSize: 19, letterSpacing: 2, borderTop: `1px solid ${rule}`, paddingTop: 20 }}>
            <span>{byline}</span>
            <span>{minutes}</span>
          </div>
        </div>
        <div style={{ display: 'flex', width: 420, height: 502, borderRadius: 6, overflow: 'hidden', background: accent.deep }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={art} width={753} height={502} alt="" style={{ objectFit: 'cover', width: 753, height: 502, marginLeft: -166 }} />
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined }
  )
}
