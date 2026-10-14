import { routing } from '@/i18n/routing'
import { getGalleryPage } from '@/lib/data/gallery'
import { getNavCategories, getSiteSettings } from '@/lib/data/site'
import { responsiveImage } from '@/lib/media/image'
import { ogPhoto } from '@/lib/seo/og-image'

/**
 * Site-wide OG card at a stable URL (pages without their own `opengraph-image` point here):
 * the admin's default OG image, else the newest approved photo of the first service.
 */
export async function GET() {
  const locale = routing.defaultLocale
  const settings = await getSiteSettings(locale)
  if (settings.defaultOgImage && typeof settings.defaultOgImage === 'object') return ogPhoto(responsiveImage(settings.defaultOgImage).src)
  const first = (await getNavCategories(locale))[0]
  const photo = first ? (await getGalleryPage(locale, { categoryId: first.id, limit: 1 })).items[0] : undefined
  return ogPhoto(photo && responsiveImage(photo.media).src)
}
