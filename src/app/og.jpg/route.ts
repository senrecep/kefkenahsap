import { unstable_cache } from 'next/cache'

import { routing } from '@/i18n/routing'
import { getHeroFallback, getHomepage } from '@/lib/data/home'
import { TAGS } from '@/lib/data/payload'
import { getSiteSettings } from '@/lib/data/site'
import { responsiveImage, type MediaLike } from '@/lib/media/image'
import { ogJpeg, ogResponse } from '@/lib/seo/og-image'

// Reads CMS data per request (no DB at build time).
export const dynamic = 'force-dynamic'

const media = (v: unknown) => (v && typeof v === 'object' ? (v as MediaLike) : undefined)

// Encoded card per photo URL, so sharp runs once per photo, not per request. A failure throws, which
// unstable_cache does not store, so a transient fetch error is retried on the next request.
const cachedCard = (url: string) =>
  unstable_cache(
    async () => {
      const bytes = await ogJpeg(url)
      if (!bytes) throw new Error(`OG photo unavailable: ${url}`)
      return Buffer.from(bytes).toString('base64')
    },
    ['ogCard', url],
    { tags: [TAGS.site, TAGS.homepage, TAGS.media], revalidate: 86400 },
  )()

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
  const url = photo && responsiveImage(photo).src
  const card = url ? await cachedCard(url).catch(() => null) : null
  return ogResponse(card ? new Uint8Array(Buffer.from(card, 'base64')) : null)
}
