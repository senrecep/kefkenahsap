// The 9 references from the old site (#34, #40). Single source: seed/content/references.json (names as in PRODUCT.md).
// Create-only: runs only while the collection is empty, so an admin rename or delete is never undone by a re-run.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Payload } from 'payload'

import { parseReferences } from '@/lib/content/schema'

export async function seedReferences(payload: Payload): Promise<string> {
  const { totalDocs } = await payload.count({ collection: 'references' })
  if (totalDocs > 0) return `references: ${totalDocs} already present, left as is`
  const parsed = parseReferences(readFileSync(path.resolve(process.cwd(), 'seed/content/references.json'), 'utf8'))
  if (!parsed.ok) throw new Error(`references.json: ${parsed.errors.map((e) => e.description).join('; ')}`)
  const locales = payload.config.localization ? payload.config.localization.localeCodes : []
  for (const ref of parsed.value) {
    const [first, ...rest] = locales.filter((l): l is keyof typeof ref.location => l in ref.location)
    const doc = await payload.create({ collection: 'references', locale: first, data: { name: ref.name, location: ref.location[first] } })
    for (const locale of rest) await payload.update({ collection: 'references', id: doc.id, locale, data: { location: ref.location[locale] } })
  }
  return `references: ${parsed.value.length} created`
}
