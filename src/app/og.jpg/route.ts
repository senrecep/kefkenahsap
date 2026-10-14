import { routing } from '@/i18n/routing'
import { getHeroFallback, getHomepage } from '@/lib/data/home'
import { getSiteSettings } from '@/lib/data/site'
import { responsiveImage, type MediaLike } from '@/lib/media/image'
import { ogPhoto } from '@/lib/seo/og-image'

const media = (v: unknown) => (v && typeof v === 'object' ? (v as MediaLike) : undefined)

/**
 * Site-wide OG card at a stable URL (pages without their own `opengraph-image` point here):
 * the admin's default OG image, else the homepage hero photo (admin pick, else its fallback).
 */
export async function GET() {
  const locale = routing.defaultLocale
  const [settings, home] = await Promise.all([getSiteSettings(locale), getHomepage(locale).catch(() => null)])
  const hero = home?._status === 'published' ? home.layout?.find((b) => b.blockType === 'hero') : undefined
  const photo =
    media(settings.defaultOgImage) ??
    media(hero && 'image' in hero ? hero.image : undefined) ??
    (await getHeroFallback(locale).catch(() => null))?.media
  return ogPhoto(photo && responsiveImage(photo).src)
}
