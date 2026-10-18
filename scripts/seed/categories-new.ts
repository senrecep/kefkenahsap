// #172: creates the categories added after launch (SEED_CATEGORIES with `folder: null`) on an already-seeded database,
// with their committed texts (name, slug, shortDesc, body, FAQ) in all five locales, published in one go: the owner
// approves the run beforehand, so there is never a name-only page. Fill-safe: a category that exists (found by its TR
// slug) only gets its empty fields filled, per locale; what the owner edited stays, and a re-run writes nothing.
// A published category with a newer unpublished draft is skipped and listed (a publish would publish that draft too),
// and the run exits 1. Photos and the cover come from the photo loader; the page renders without them.
// Order and caveats: docs/RUNBOOK.md "Category rename and new categories (#172)".
// --dry-run writes nothing; a non-local database needs --yes; SITE_ENV=production is refused.
// Run: bun run payload run scripts/seed/categories-new.ts [-- --dry-run | --yes]
import path from 'node:path'
import { convertMarkdownToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { fillEmpty } from '@/lib/content/merge'
import type { Config } from '@/payload-types'
import { SEED_CATEGORIES } from '@/seed/categories'

import { categoryTexts, guardTarget } from './i18n'

type Locale = Config['locale']
const dryRun = process.argv.includes('--dry-run')
const SEED = path.resolve(process.cwd(), 'seed')
guardTarget(dryRun)
const payload = await getPayload({ config: await config })
const editorConfig = await editorConfigFactory.default({ config: payload.config })
const lexical = (markdown: string) => convertMarkdownToLexical({ editorConfig, markdown })
const tag = dryRun ? '[dry run] ' : ''
let writes = 0
const pending: string[] = []
const failed: string[] = []

for (const cat of SEED_CATEGORIES.filter((c) => !c.folder)) {
  const label = `category ${cat.slug.tr}`
  const texts = categoryTexts(SEED, cat, lexical)
  const locales = Object.keys(texts) as Locale[]
  try {
    const found = (await payload.find({ collection: 'categories', locale: 'tr', draft: true, where: { slug: { equals: cat.slug.tr } }, limit: 1, depth: 0 })).docs[0]
    if (!found) {
      console.log(`${tag}${label}: create, published (${locales.join(', ')})`)
      writes += locales.length
      if (dryRun) continue
      const { id } = await payload.create({ collection: 'categories', locale: 'tr', data: { ...texts.tr, _status: 'published' } as never, context: { skipAi: true } })
      for (const l of locales.filter((x) => x !== 'tr'))
        await payload.update({ collection: 'categories', id, locale: l, data: { ...texts[l], _status: 'published' } as never, context: { skipAi: true } })
      continue
    }
    const main = await payload.findByID({ collection: 'categories', id: found.id, depth: 0 })
    if (main._status === 'published' && found._status !== 'published') {
      pending.push(label)
      continue
    }
    for (const l of locales) {
      // The latest version: the one a write builds on.
      const current = await payload.findByID({ collection: 'categories', id: found.id, locale: l, fallbackLocale: false, draft: true, depth: 0 })
      const patch = fillEmpty(current as never, texts[l])
      if (!Object.keys(patch).length) continue
      console.log(`${tag}${label} [${l}]: ${Object.keys(patch).join(', ')}`)
      writes++
      if (!dryRun) await payload.update({ collection: 'categories', id: found.id, locale: l, data: { ...patch, _status: 'published' } as never, context: { skipAi: true } })
    }
  } catch (err) {
    failed.push(label)
    console.error(`${label}: ${err instanceof Error ? err.message : err}`)
  }
}
console.log(`${tag}categories-new: ${writes} locale write(s), ${pending.length} skipped (unpublished draft), ${failed.length} failed`)
for (const [what, list] of [['unpublished drafts, left as is', pending], ['failed', failed]] as const) if (list.length) console.log(`${what}: ${list.join(' · ')}`)
process.exit(failed.length || pending.length ? 1 : 0)
