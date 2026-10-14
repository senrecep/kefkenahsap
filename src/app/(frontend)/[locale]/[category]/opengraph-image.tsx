import { hasLocale } from 'next-intl'

import { routing, type Locale } from '@/i18n/routing'
import { getCategory } from '@/lib/data/categories'
import { safeDecode } from '@/lib/http/safe-decode'
import { responsiveImage } from '@/lib/media/image'
import { OG_CONTENT_TYPE, OG_SIZE, ogJpeg, ogResponse } from '@/lib/seo/og-image'

export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

/** The approved cover, else the first gallery photo: the same header photo the page shows. */
export default async function Image({ params }: { params: Promise<{ locale: Locale; category: string }> }) {
  const { locale, category: slug } = await params
  if (!hasLocale(routing.locales, locale) || slug.length > 200) return new Response(null, { status: 404 })
  const data = await getCategory(locale, safeDecode(slug), 1)
  if (!data) return new Response(null, { status: 404 })
  const { cover } = data.category
  const photo = typeof cover === 'object' && cover?.status === 'approved' ? cover : data.photos[0]
  return ogResponse(photo ? await ogJpeg(responsiveImage(photo).src) : null)
}
