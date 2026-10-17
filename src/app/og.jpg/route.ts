import { unstable_cache } from 'next/cache'

import { routing } from '@/i18n/routing'
import { TAGS } from '@/lib/data/payload'
import { getSiteSettings } from '@/lib/data/site'
import { responsiveImage } from '@/lib/media/image'
import { ogJpeg, ogResponse } from '@/lib/seo/og-image'
import { adminOgMedia } from '@/lib/seo/metadata'

// Reads CMS data per request (no DB at build time).
export const dynamic = 'force-dynamic'

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
    { tags: [TAGS.site, TAGS.media], revalidate: 86400 },
  )()

/**
 * The admin's default share image cropped to 1200×630 (pages point here only while it is set, see siteOgImage).
 * Without it, the generated card of the default language.
 */
export async function GET() {
  const settings = await getSiteSettings(routing.defaultLocale)
  const photo = adminOgMedia(settings.defaultOgImage)
  // Relative Location: behind the proxy the request URL carries the internal host.
  if (!photo) return new Response(null, { status: 307, headers: { Location: `/og-${routing.defaultLocale}.png` } })
  const url = responsiveImage(photo).src
  const card = url ? await cachedCard(url).catch(() => null) : null
  return ogResponse(card ? new Uint8Array(Buffer.from(card, 'base64')) : null)
}
