import type { Payload } from 'payload'

import { routing, type Locale } from '@/i18n/routing'
import type { Media } from '@/payload-types'

/** A photo whose alt text is the default locale's stand-in: `altLang` becomes the img's `lang`. */
export type WithAltLang<T> = T & { altLang?: string }

const altsIn = async (payload: Payload, locale: Locale, ids: number[]) => {
  const res = await payload.find({ collection: 'media', locale, fallbackLocale: false, depth: 0, limit: ids.length, pagination: false, where: { id: { in: ids } }, select: { alt: true } })
  return new Map(res.docs.map((d) => [d.id, d.alt?.trim() ? d.alt : null]))
}

/**
 * Photos read without fallback whose alt text is not translated into `locale` get the default locale's, marked with
 * `altLang` (an image link needs a name, WCAG 2.4.4; the stand-in is announced in its own language). One query.
 */
export async function withDefaultAlt<T extends Media>(payload: Payload, locale: Locale, media: T[]): Promise<WithAltLang<T>[]> {
  const missing = media.filter((m) => !m.alt?.trim()).map((m) => m.id)
  if (locale === routing.defaultLocale || !missing.length) return media
  const alt = await altsIn(payload, routing.defaultLocale, missing)
  return media.map((m) => (m.alt?.trim() || !alt.get(m.id) ? m : { ...m, alt: alt.get(m.id)!, altLang: routing.defaultLocale }))
}

/** Photos read with `fallbackLocale: 'tr'` (gallery): marks the ones whose alt is that fallback, not their own. */
export async function markFallbackAlt<T extends Media>(payload: Payload, locale: Locale, media: T[]): Promise<WithAltLang<T>[]> {
  if (locale === routing.defaultLocale || !media.length) return media
  const own = await altsIn(payload, locale, media.map((m) => m.id))
  return media.map((m) => (own.get(m.id) || !m.alt?.trim() ? m : { ...m, altLang: routing.defaultLocale }))
}
