// #138: applies seed/i18n/sentence-case.json (`{ "<path under seed/>": { tr: { old, new }, en: { old, new } } }`) to the
// seeded photos' TR/EN titles. A title is changed only while it is still exactly `old`, so an owner's edit is kept.
// --seed-files: rewrites the committed seed/media-meta* JSON titles instead (no database), so a fresh seed is right.
// --map=<file>: another mapping file. --dry-run writes nothing; a non-local database needs --yes.
// Run: bun run payload run scripts/seed/media-title-case.ts [-- --dry-run | --yes | --seed-files]
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'
import { Maybe } from 'tsentials/maybe'

import config from '@/payload.config'
import { mediaSeedKey, sentenceCaseUpdate } from '@/lib/content/overlay'
import { parseSentenceCase } from '@/lib/content/schema'

import { guardTarget, unwrap } from './i18n'

const dryRun = process.argv.includes('--dry-run')
const SEED = path.resolve(process.cwd(), 'seed')
const mapFile = process.argv.find((a) => a.startsWith('--map='))?.slice('--map='.length) ?? path.join(SEED, 'i18n/sentence-case.json')
const mapping = Object.entries(unwrap(parseSentenceCase(readFileSync(mapFile, 'utf8'))))
const LOCALES = ['tr', 'en'] as const
let updated = 0
let skipped = 0

if (process.argv.includes('--seed-files')) {
  for (const [rel, change] of mapping) {
    const file = path.join(SEED, rel)
    const original = readFileSync(file, 'utf8')
    const meta = JSON.parse(original) as { title: Record<string, string> }
    for (const l of LOCALES) {
      const next = change[l] ? sentenceCaseUpdate(meta.title[l], change[l]) : Maybe.none<string>()
      if (Maybe.isSome(next)) meta.title[l] = next.value
      else skipped++
    }
    // 2-space JSON like the committed files, keeping whether the file ends in a newline.
    const json = JSON.stringify(meta, null, 2) + (original.endsWith('\n') ? '\n' : '')
    if (json === original) continue
    if (!dryRun) writeFileSync(file, json)
    updated++
  }
  console.log(`${dryRun ? '[dry run] ' : ''}seed files: ${updated} rewritten, ${skipped} title(s) left as is`)
  process.exit(0)
}

guardTarget(dryRun)
const payload = await getPayload({ config: await config })
let missing = 0
for (const [rel, change] of mapping) {
  const seedKey = unwrap(mediaSeedKey(SEED, rel))
  const doc = (await payload.find({ collection: 'media', where: { seedKey: { equals: seedKey } }, limit: 1, depth: 0, select: { seedKey: true } })).docs[0]
  if (!doc) {
    missing++
    continue
  }
  for (const locale of LOCALES) {
    if (!change[locale]) continue
    const { title } = await payload.findByID({ collection: 'media', id: doc.id, locale, fallbackLocale: false, depth: 0 })
    const next = sentenceCaseUpdate(title, change[locale])
    if (!Maybe.isSome(next)) {
      skipped++
      continue
    }
    if (!dryRun) await payload.update({ collection: 'media', id: doc.id, locale, data: { title: next.value }, context: { skipAi: true } })
    updated++
  }
}
console.log(`${dryRun ? '[dry run] ' : ''}media titles: ${updated} updated, ${skipped} skipped (edited or already sentence case), ${missing} mapping entr(ies) with no photo`)
process.exit(0)
