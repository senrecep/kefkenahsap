import type { Locale } from '@/i18n/routing'
import { getProject } from '@/lib/data/projects'
import { safeDecode } from '@/lib/http/safe-decode'
import { responsiveImage } from '@/lib/media/image'
import { OG_CONTENT_TYPE, OG_SIZE, ogJpeg, ogResponse } from '@/lib/seo/og-image'

export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

/** The project's cover (else its first photo), as on the page hero. */
export default async function Image({ params }: { params: Promise<{ locale: Locale; slug: string }> }) {
  const { locale, slug } = await params
  if (slug.length > 200) return new Response(null, { status: 404 })
  const data = await getProject(locale, safeDecode(slug))
  if (!data) return new Response(null, { status: 404 })
  const photo = data.cover ?? data.gallery[0]
  return ogResponse(photo ? await ogJpeg(responsiveImage(photo).src) : null)
}
