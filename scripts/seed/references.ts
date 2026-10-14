// #40: the 9 references from the old site (docs/legacy/crawl-md/www.kefkenahsap.com_referanslar_.md), names and locations as listed, no logos.
// Idempotent: a reference whose name already exists is left as the owner edited it.
// Run: bun run payload run scripts/seed/references.ts
import { getPayload } from 'payload'

import config from '@/payload.config'
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

const payload = await getPayload({ config })
let created = 0
for (const [name, location] of REFERENCES) {
  const found = await payload.find({ collection: 'references', where: { name: { equals: name } }, limit: 1, depth: 0 })
  if (found.docs.length) continue
  const doc = await payload.create({ collection: 'references', locale: routing.defaultLocale, data: { name, location } })
  // Place names read the same in every locale.
  for (const locale of routing.locales.filter((l) => l !== routing.defaultLocale)) {
    await payload.update({ collection: 'references', id: doc.id, locale, data: { location } })
  }
  created++
}
console.log(`references: ${created} created, ${REFERENCES.length - created} already present`)
process.exit(0)
