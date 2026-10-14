import type { Payload } from 'payload'

import { routing, type Locale } from '@/i18n/routing'
import type { Media } from '@/payload-types'

/**
 * Photos whose alt text is not translated into `locale` get the default locale's (an image link needs a name, WCAG
 * 2.4.4); the gallery does the same through `fallbackLocale`. One query for all of them.
 */
export async function withDefaultAlt<T extends Media>(payload: Payload, locale: Locale, media: T[]): Promise<T[]> {
  const missing = media.filter((m) => !m.alt?.trim()).map((m) => m.id)
  if (locale === routing.defaultLocale || !missing.length) return media
  const res = await payload.find({ collection: 'media', locale: routing.defaultLocale, depth: 0, limit: missing.length, pagination: false, where: { id: { in: missing } }, select: { alt: true } })
  const alt = new Map(res.docs.map((d) => [d.id, d.alt]))
  return media.map((m) => (m.alt?.trim() ? m : { ...m, alt: alt.get(m.id) ?? m.alt }))
}
