import type { Locale } from '@/i18n/routing'
import { getImage } from '@/lib/data/gallery'
import { responsiveImage } from '@/lib/media/image'
import { OG_CONTENT_TYPE, OG_SIZE, ogPhoto } from '@/lib/seo/og-image'

export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default async function Image({ params }: { params: Promise<{ locale: Locale; slug: string }> }) {
  const { locale, slug } = await params
  const image = await getImage(locale, slug)
  return ogPhoto(image && responsiveImage(image.item.media).src)
}
