import type { Locale } from '@/i18n/routing'
import { getImage } from '@/lib/data/gallery'
import { responsiveImage } from '@/lib/media/image'
import { OG_CONTENT_TYPE, OG_SIZE, ogJpeg, ogResponse } from '@/lib/seo/og-image'

export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default async function Image({ params }: { params: Promise<{ locale: Locale; slug: string }> }) {
  const { locale, slug } = await params
  // Visitor-chosen key: bound it before it reaches the cache/DB lookup.
  if (slug.length > 200) return new Response(null, { status: 404 })
  const image = await getImage(locale, slug)
  if (!image) return new Response(null, { status: 404 })
  return ogResponse(await ogJpeg(responsiveImage(image.item.media).src))
}
