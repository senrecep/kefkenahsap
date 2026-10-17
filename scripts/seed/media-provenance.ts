// #203: one-time provenance backfill for photos that have none (seeded before #203). Their non-TR texts came from the
// seed AI pipeline and were never hand-edited, so the current texts are recorded as the AI's, made from the current TR
// text (backfillSync). A later TR edit then re-translates them instead of flagging them stale. Text is never changed;
// empty locale fields are left for translation. Photos that already have a record are skipped, so a re-run writes nothing.
// Writes with the seed context (skipAi): no translateMedia job is queued.
// --dry-run writes nothing; a non-local database needs --yes; SITE_ENV=production is refused.
// Run: bun run payload run scripts/seed/media-provenance.ts [-- --dry-run | --yes]
import { getPayload } from 'payload'

import config from '@/payload.config'
import { routing } from '@/i18n/routing'
import { backfillSync, SYNC_FIELDS, type SyncField } from '@/lib/media/i18nSync'

import { seedCtx } from './archive-media'
import { guardTarget } from './i18n'

const dryRun = process.argv.includes('--dry-run')
guardTarget(dryRun)
const payload = await getPayload({ config: await config })

type Doc = { id: number; i18nSync?: unknown } & Record<SyncField, Partial<Record<string, string | null>> | null>
const docs = (await payload.find({
  collection: 'media',
  locale: 'all',
  pagination: false,
  limit: 0,
  depth: 0,
  select: { title: true, alt: true, caption: true, i18nSync: true },
})).docs as unknown as Doc[]

const counts = { recorded: 0, fields: 0, alreadyRecorded: 0, noText: 0 }
const failed: number[] = []
const others = routing.locales.filter((l) => l !== routing.defaultLocale)
for (const doc of docs) {
  if (doc.i18nSync) {
    counts.alreadyRecorded++
    continue
  }
  const pick = (l: string) => Object.fromEntries(SYNC_FIELDS.map((f) => [f, doc[f]?.[l]]))
  const sync = backfillSync(pick(routing.defaultLocale), Object.fromEntries(others.map((l) => [l, pick(l)])))
  if (!sync) {
    counts.noText++
    continue
  }
  try {
    if (!dryRun) await payload.update({ collection: 'media', id: doc.id, locale: routing.defaultLocale, data: { i18nSync: sync }, context: seedCtx(), depth: 0 })
    counts.recorded++
    counts.fields += Object.values(sync.prov!).reduce((n, p) => n + Object.keys(p ?? {}).length, 0)
  } catch (err) {
    // One bad photo must not stop the rest; listed below, and the run exits 1.
    failed.push(doc.id)
    console.error(`media ${doc.id}: ${err instanceof Error ? err.message : err}`)
  }
}
console.log(
  `${dryRun ? '[dry run] ' : ''}provenance: ${counts.recorded} photo(s) recorded (${counts.fields} locale field(s)), ${counts.alreadyRecorded} already had a record, ${counts.noText} with no non-TR text, ${failed.length} failed`,
)
if (failed.length) console.error(`failed: ${failed.join(', ')}`)
process.exit(failed.length ? 1 : 0)
