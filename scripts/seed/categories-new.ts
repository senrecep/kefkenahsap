// #172: creates the categories added after launch (SEED_CATEGORIES with `folder: null`) on an already-seeded database,
// exactly as seed.ts creates a category: TR + EN name and slug, published. A category that exists (found by its TR
// slug) is left as is; only an EN name that a died run left empty is filled. So a re-run writes nothing.
// Their texts (shortDesc/body/FAQ, ru/de/ar name + slug) come from content.ts afterwards, as drafts. Photos and the
// cover come from the photo loader; the page renders without them.
// Order on an existing database: categories-rename.ts → categories-new.ts → content.ts.
// --dry-run writes nothing; a non-local database needs --yes; SITE_ENV=production is refused.
// Run: bun run payload run scripts/seed/categories-new.ts [-- --dry-run | --yes]
import { getPayload } from 'payload'

import config from '@/payload.config'
import { SEED_CATEGORIES } from '@/seed/categories'

import { guardTarget } from './i18n'

const dryRun = process.argv.includes('--dry-run')
guardTarget(dryRun)
const payload = await getPayload({ config: await config })
const tag = dryRun ? '[dry run] ' : ''
let writes = 0

for (const cat of SEED_CATEGORIES.filter((c) => !c.folder)) {
  const found = (await payload.find({ collection: 'categories', locale: 'tr', draft: true, where: { slug: { equals: cat.slug.tr } }, limit: 1, depth: 0 })).docs[0]
  const en = { name: cat.name.en, slug: cat.slug.en, _status: 'published' as const }
  if (!found) {
    console.log(`${tag}category ${cat.slug.tr}: create (tr + en, published)`)
    if (!dryRun) {
      const c = await payload.create({ collection: 'categories', locale: 'tr', data: { name: cat.name.tr, slug: cat.slug.tr, _status: 'published' } })
      await payload.update({ collection: 'categories', id: c.id, locale: 'en', data: en })
    }
    writes++
    continue
  }
  const current = await payload.findByID({ collection: 'categories', id: found.id, locale: 'en', fallbackLocale: false, depth: 0 })
  if (current.name) continue
  console.log(`${tag}category ${cat.slug.tr}: fill en name/slug`)
  if (!dryRun) await payload.update({ collection: 'categories', id: found.id, locale: 'en', data: en })
  writes++
}
console.log(`${tag}categories-new: ${writes} write(s)${writes && !dryRun ? ' — now run scripts/seed/content.ts for the texts' : ''}`)
process.exit(0)
