// #40: the 9 references from the old site (docs/legacy/crawl-md/www.kefkenahsap.com_referanslar_.md), names and locations as listed, no logos.
import type { Payload } from 'payload'

import { routing } from '@/i18n/routing'

const REFERENCES: [name: string, location: string][] = [
  ['Cennetköy Sitesi', 'Yalıkavak / Bodrum'],
  ['Riva Konakları Sitesi', 'Riva / İstanbul'],
  ['Kemer Golf & Contry Clup', 'Göktürk / istanbul'],
  ['Neo Gölpark Evleri', 'Bolluca / İstanbul'],
  ['İ.B.B Sosyal Tesisler', 'İ.B.B / İstanbul'],
  ['Mesa Mesken', 'Bahçeşehir / İstanbul'],
  ['Nurol A.S', 'Bahçeşehir / İstanbul'],
  ['Yaşar Holding', 'Tripoli / Libya'],
  ['İ.G.K', 'Levent / İstanbul'],
]

/** Idempotent by name: existing references keep the owner's edits; only a missing location in a locale is filled. */
export async function seedReferences(payload: Payload): Promise<string> {
  let created = 0
  let filled = 0
  for (const [name, location] of REFERENCES) {
    const found = await payload.find({ collection: 'references', where: { name: { equals: name } }, limit: 1, depth: 0 })
    const id = found.docs[0]?.id ?? (await payload.create({ collection: 'references', locale: routing.defaultLocale, data: { name, location } })).id
    if (!found.docs.length) created++
    // Place names read the same in every locale.
    for (const locale of routing.locales) {
      const doc = await payload.findByID({ collection: 'references', id, locale, depth: 0 })
      if (doc.location) continue
      await payload.update({ collection: 'references', id, locale, data: { location } })
      if (found.docs.length) filled++
    }
  }
  return `references: ${created} created, ${REFERENCES.length - created} already present, ${filled} missing locations filled`
}
