// #180: applies the language review of the 2026-10-16 texts to an already-seeded database: the six category texts (#174)
// and the ru/de/ar archive photo texts (#176). seed/i18n/text-fixes-180.json holds the replaced (old) texts; the new ones
// are the committed seed. A field is written only while its stored value is still exactly the old text (owner edits and
// already fixed fields stay), so a re-run writes nothing.
// Categories are written like categories-new.ts: the latest version is read, the write is published; a published category
// with a newer unpublished draft is skipped and listed (publishing would publish that draft too), and the run exits 1.
// Photos never get `status`, so a pending photo stays pending.
// --dry-run writes nothing; a non-local database needs --yes (SEED_REMOTE=1 marks a tunnel as remote); SITE_ENV=production is refused.
// Run: bun run payload run scripts/seed/text-fixes-180.ts [-- --dry-run | --yes]
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { convertMarkdownToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { mediaSeedKey, replacedFieldsPatch } from '@/lib/content/overlay'
import { parseMediaMetaOverlay, parseReplacedTexts } from '@/lib/content/schema'
import type { Config } from '@/payload-types'
import { SEED_CATEGORIES } from '@/seed/categories'

import { categoryTexts, guardTarget, loadOverlay, unwrap } from './i18n'

type Locale = Config['locale']
const dryRun = process.argv.includes('--dry-run')
const SEED = path.resolve(process.cwd(), 'seed')
const replaced = unwrap(parseReplacedTexts(readFileSync(path.join(SEED, 'i18n/text-fixes-180.json'), 'utf8')))
guardTarget(dryRun)
const payload = await getPayload({ config: await config })
const editorConfig = await editorConfigFactory.default({ config: payload.config })
const lexical = (markdown: string) => convertMarkdownToLexical({ editorConfig, markdown })
const tag = dryRun ? '[dry run] ' : ''
const counts = { fields: 0, kept: 0, missing: 0 }
const pending: string[] = []
const failed: string[] = []

/** Writes `patch` (built by replacedFieldsPatch) and counts written and kept (edited or already fixed) fields. */
const tally = (old: Record<string, unknown>, patch: Record<string, unknown>) => {
  counts.fields += Object.keys(patch).length
  counts.kept += Object.keys(old).length - Object.keys(patch).length
}

for (const [slug, byLocale] of Object.entries(replaced.categories)) {
  const label = `category ${slug}`
  try {
    const cat = SEED_CATEGORIES.find((c) => c.slug.tr === slug)
    if (!cat) throw new Error('not in SEED_CATEGORIES')
    const texts = categoryTexts(SEED, cat, lexical)
    const found = (await payload.find({ collection: 'categories', locale: 'tr', draft: true, where: { slug: { equals: slug } }, limit: 1, depth: 0 })).docs[0]
    if (!found) {
      counts.missing++
      console.log(`${label}: not in this database`)
      continue
    }
    const main = await payload.findByID({ collection: 'categories', id: found.id, depth: 0 })
    if (main._status === 'published' && found._status !== 'published') {
      pending.push(label)
      continue
    }
    for (const [locale, oldFields] of Object.entries(byLocale) as [Locale, Record<string, unknown>][]) {
      const old = { ...oldFields, ...(typeof oldFields.body === 'string' ? { body: lexical(oldFields.body) } : {}) }
      // The latest version: the one a write builds on.
      const current = await payload.findByID({ collection: 'categories', id: found.id, locale, fallbackLocale: false, draft: true, depth: 0 })
      const patch = replacedFieldsPatch(current as never, old, texts[locale])
      tally(old, patch)
      if (!Object.keys(patch).length) continue
      console.log(`${tag}${label} [${locale}]: ${Object.keys(patch).join(', ')}`)
      if (!dryRun) await payload.update({ collection: 'categories', id: found.id, locale, data: { ...patch, _status: 'published' } as never, context: { skipAi: true } })
    }
  } catch (err) {
    failed.push(label)
    console.error(`${label}: ${err instanceof Error ? err.message : err}`)
  }
}

for (const [rel, byLocale] of Object.entries(replaced.media)) {
  try {
    const seedKey = unwrap(mediaSeedKey(SEED, rel))
    const doc = (await payload.find({ collection: 'media', where: { seedKey: { equals: seedKey } }, limit: 1, depth: 0, select: { seedKey: true } })).docs[0]
    if (!doc) {
      counts.missing++
      continue
    }
    for (const [locale, old] of Object.entries(byLocale) as [Locale, Record<string, string>][]) {
      const next = loadOverlay(SEED, locale, rel, parseMediaMetaOverlay)
      if (!next) throw new Error(`${locale}/${rel} missing`)
      const current = await payload.findByID({ collection: 'media', id: doc.id, locale, fallbackLocale: false, depth: 0 })
      const patch = replacedFieldsPatch(current as never, old, next)
      tally(old, patch)
      if (Object.keys(patch).length && !dryRun) await payload.update({ collection: 'media', id: doc.id, locale, data: patch, context: { skipAi: true } })
    }
  } catch (err) {
    // One bad photo must not stop the rest; listed below, and the run exits 1.
    failed.push(rel)
    console.error(`media ${rel}: ${err instanceof Error ? err.message : err}`)
  }
}

console.log(
  `${tag}text-fixes-180: ${counts.fields} field(s) updated, ${counts.kept} kept (edited or already fixed), ${counts.missing} record(s) not in this database, ${pending.length} skipped (unpublished draft), ${failed.length} failed`,
)
for (const [what, list] of [['unpublished drafts, left as is', pending], ['failed', failed]] as const) if (list.length) console.log(`${what}: ${list.join(' · ')}`)
process.exit(failed.length || pending.length ? 1 : 0)
