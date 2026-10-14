// #138: applies the TR/EN text fixes of the seeded photos: seed/i18n/sentence-case.json (titles, `{ "<path under seed/>":
// { tr: { old, new }, en: … } }`) and seed/i18n/text-fixes.json (`{ "<path>": { title?|caption?: { tr: { old, new }, … } } }`).
// A field is changed only while it is still exactly `old`, so an owner's edit is kept. Idempotent.
// --seed-files: rewrites the committed seed/media-meta* JSONs instead (no database), so a fresh seed is right.
// --dry-run writes nothing; a non-local database needs --yes.
// Run: bun run payload run scripts/seed/media-text-fixes.ts [-- --dry-run | --yes | --seed-files]
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'
import { Maybe } from 'tsentials/maybe'
import type { Result } from 'tsentials/result'

import config from '@/payload.config'
import { mediaSeedKey, mergeTextFixes, textFixUpdate } from '@/lib/content/overlay'
import { parseSentenceCase, parseTextFixes } from '@/lib/content/schema'

import { guardTarget, unwrap } from './i18n'

const dryRun = process.argv.includes('--dry-run')
const SEED = path.resolve(process.cwd(), 'seed')
const load = <T>(rel: string, parse: (json: string) => Result<T>): T => {
  const file = path.join(SEED, rel)
  if (!existsSync(file)) {
    console.error(`Missing mapping file seed/${rel} (see RUNBOOK "Loading translations").`)
    process.exit(1)
  }
  return unwrap(parse(readFileSync(file, 'utf8')))
}
const fixes = Object.entries(mergeTextFixes(load('i18n/sentence-case.json', parseSentenceCase), load('i18n/text-fixes.json', parseTextFixes)))
const LOCALES = ['tr', 'en'] as const
let updated = 0
let skipped = 0

/** field → new value for one locale, from the fields still equal to their `old` text. */
const patchFor = (fields: (typeof fixes)[number][1], locale: (typeof LOCALES)[number], current: (field: 'title' | 'caption') => string | null | undefined) => {
  const patch: Record<string, string> = {}
  for (const field of ['title', 'caption'] as const) {
    const change = fields[field]?.[locale]
    if (!change) continue
    const next = textFixUpdate(current(field), change)
    if (Maybe.isSome(next)) patch[field] = next.value
    else skipped++
  }
  return patch
}

if (process.argv.includes('--seed-files')) {
  for (const [rel, fields] of fixes) {
    const file = path.join(SEED, rel)
    const original = readFileSync(file, 'utf8')
    const meta = JSON.parse(original) as Record<'title' | 'caption', Record<string, string>>
    for (const l of LOCALES) for (const [field, value] of Object.entries(patchFor(fields, l, (f) => meta[f][l]))) meta[field as 'title' | 'caption'][l] = value
    // 2-space JSON like the committed files, keeping whether the file ends in a newline.
    const json = JSON.stringify(meta, null, 2) + (original.endsWith('\n') ? '\n' : '')
    if (json === original) continue
    if (!dryRun) writeFileSync(file, json)
    updated++
  }
  console.log(`${dryRun ? '[dry run] ' : ''}seed files: ${updated} rewritten, ${skipped} field(s) left as is`)
  process.exit(0)
}

guardTarget(dryRun)
const payload = await getPayload({ config: await config })
let missing = 0
const failed: string[] = []
for (const [rel, fields] of fixes) {
  const seedKey = unwrap(mediaSeedKey(SEED, rel))
  try {
    const doc = (await payload.find({ collection: 'media', where: { seedKey: { equals: seedKey } }, limit: 1, depth: 0, select: { seedKey: true } })).docs[0]
    if (!doc) {
      missing++
      continue
    }
    for (const locale of LOCALES) {
      const current = await payload.findByID({ collection: 'media', id: doc.id, locale, fallbackLocale: false, depth: 0 })
      const patch = patchFor(fields, locale, (f) => current[f])
      if (!Object.keys(patch).length) continue
      if (!dryRun) await payload.update({ collection: 'media', id: doc.id, locale, data: patch, context: { skipAi: true } })
      updated += Object.keys(patch).length
    }
  } catch (err) {
    // One bad photo must not stop the rest; listed below, and the run exits 1.
    failed.push(seedKey)
    console.error(`media ${seedKey}: ${err instanceof Error ? err.message : err}`)
  }
}
console.log(`${dryRun ? '[dry run] ' : ''}media texts: ${updated} field(s) updated, ${skipped} skipped (edited or already fixed), ${missing} entr(ies) with no photo, ${failed.length} failed`)
if (failed.length) console.error(`failed: ${failed.join(', ')}`)
process.exit(failed.length ? 1 : 0)
