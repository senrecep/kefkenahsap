// #171: loads the taxonomy v0 tags (seed/editorial/taxonomy-v0.json, the committed subset of
// image-work/taxonomy/v0.json): every product type (axis `type`), the new settings `ticari` and `giris`, and the new
// finishes. tr/en names and slugs come from v0, ru/de/ar from
// seed/editorial/tags-type-axis.json (see taxonomyTagDefs). Upsert by tr slug (else en slug), fill-only: a missing tag is created; an
// existing one only gets its empty locale names/slugs filled, so an owner's rename is kept and a re-run writes nothing.
// A tag found on another axis is left as is and listed. No photo is tagged here.
// --dry-run writes nothing; a non-local database needs --yes; SITE_ENV=production is refused.
// Run: bun run payload run scripts/seed/tags-type-axis.ts [-- --dry-run | --yes] [--v0=<path to a v0.json>]
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { taxonomyTagDefs } from '@/lib/content/editorial'
import { parseTagTranslations, parseTaxonomyV0 } from '@/lib/content/schema'
import type { Config } from '@/payload-types'

import { fillLocales, guardTarget, unwrap } from './i18n'

type Locale = Config['locale']
const dryRun = process.argv.includes('--dry-run')
const dry = dryRun ? '[dry run] ' : ''
// Default: the committed subset of image-work/taxonomy/v0.json; --v0=<path> reads another copy (e.g. a newer v0.json).
const v0Path = path.resolve(process.cwd(), process.argv.find((a) => a.startsWith('--v0='))?.slice('--v0='.length) ?? 'seed/editorial/taxonomy-v0.json')
if (!existsSync(v0Path)) {
  console.error(`taxonomy file not found: ${v0Path}`)
  process.exit(1)
}
const translations = unwrap(
  parseTagTranslations(
    readFileSync(path.resolve(process.cwd(), 'seed/editorial/tags-type-axis.json'), 'utf8'),
  ),
).tags
const defs = unwrap(
  taxonomyTagDefs(unwrap(parseTaxonomyV0(readFileSync(v0Path, 'utf8'))).tags, translations),
)

guardTarget(dryRun)
console.log(`v0: ${v0Path}`)
const payload = await getPayload({ config: await config })
const locales = (
  payload.config.localization ? payload.config.localization.localeCodes : []
) as Locale[]

const counts = { created: 0, filled: 0, unchanged: 0 }
const otherAxis: string[] = []
const failed: string[] = []
for (const def of defs) {
  const label = `tag ${def.slug.tr} (${def.axis})`
  try {
    // Matched by tr slug, else by en slug (a tag the owner renamed in TR but kept in EN is still the same tag).
    let found: { id: number; axis: string } | undefined
    for (const locale of ['tr', 'en'] as const) {
      found ??= (await payload.find({ collection: 'tags', locale, where: { slug: { equals: def.slug[locale] } }, limit: 1, depth: 0, select: { axis: true } })).docs[0]
    }
    if (found && found.axis !== def.axis) {
      otherAxis.push(`${def.slug.tr} (${found.axis}, v0: ${def.axis})`)
      continue
    }
    let id = found?.id
    if (!id) {
      console.log(`${dry}${label}: create`)
      counts.created++
      if (dryRun) continue
      id = (
        await payload.create({
          collection: 'tags',
          locale: 'tr',
          data: { name: def.name.tr, slug: def.slug.tr, axis: def.axis },
        })
      ).id
    }
    const byLocale = Object.fromEntries(
      locales.filter((l) => l !== 'tr').map((l) => [l, { name: def.name[l], slug: def.slug[l] }]),
    )
    const writes = await fillLocales(payload, 'tags', id, byLocale, { label, dryRun })
    if (found) counts[writes ? 'filled' : 'unchanged']++
  } catch (err) {
    // One bad tag (e.g. a slug another tag already uses in some locale) must not stop the rest; listed, and the run exits 1.
    failed.push(label)
    console.error(`${label}: ${err instanceof Error ? err.message : err}`)
  }
}
console.log(
  `${dry}taxonomy tags: ${counts.created} created, ${counts.filled} filled, ${counts.unchanged} unchanged, ${otherAxis.length} on another axis, ${failed.length} failed (of ${defs.length})`,
)
for (const [what, list] of [
  ['on another axis, left as is', otherAxis],
  ['failed', failed],
] as const)
  if (list.length) console.log(`${what}: ${list.join(' · ')}`)
process.exit(failed.length ? 1 : 0)
