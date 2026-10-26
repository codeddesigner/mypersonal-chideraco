import Image from 'next/image'
import { paletteFor } from '@/lib/accent'
import { coverSvg } from '@/lib/cover'

type CoverSource = { slug: string; accent: string | null; cover_image_url: string | null; cover_alt: string; cover_style?: string | null }

// Matches images.remotePatterns in next.config.mjs; anything else is served as-is.
function optimisable(url: string) {
  try {
    const u = new URL(url)
    return (
      u.protocol === 'https:' &&
      u.host.endsWith('.supabase.co') &&
      u.pathname.startsWith('/storage/v1/object/public/')
    )
  } catch {
    return false
  }
}

// An uploaded photo when there is one, otherwise the essay's generated artwork in its chosen design.
export default function Cover({
  article,
  sizes,
  priority = false,
  className = '',
}: {
  article: CoverSource
  sizes: string
  priority?: boolean
  className?: string
}) {
  const classes = `cover ${className}`.trim()
  if (article.cover_image_url) {
    return (
      <div className={classes}>
        <Image
          src={article.cover_image_url}
          alt={article.cover_alt}
          fill
          sizes={sizes}
          priority={priority}
          unoptimized={!optimisable(article.cover_image_url)}
        />
      </div>
    )
  }
  const svg = coverSvg(article.slug, paletteFor(article.accent, article.slug), article.cover_style)
  return <div className={`${classes} cover-art`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
}
