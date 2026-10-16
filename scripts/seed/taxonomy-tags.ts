// #175: tags the live and imported photos from the reviewed per-photo facts (photo-plan.json `facts`: product type,
// setting, wood, finish, stage as tag slugs), falling back per axis to the tagImage meta (tag names) of an archive photo.
// Only adds (src/lib/media/taxonomy.ts tagIdsToAdd): a tag the photo has is kept, and wood/finish/stage are left alone on
// a photo that already has one. Values without a matching tag are listed. A re-run writes nothing.
// Run after taxonomy-import.ts, so the new photos are there. Needs the type tags (tags-type-axis.ts).
// --dry-run writes nothing; a non-local database needs --yes; SITE_ENV=production is refused.
// Run: bun run payload run scripts/seed/taxonomy-tags.ts [-- --dry-run | --yes]
import { getPayload } from 'payload'

import config from '@/payload.config'
import { type Axis, type TagRef, tagIdsToAdd } from '@/lib/media/taxonomy'

import { seedCtx } from './archive-media'
import { guardTarget } from './i18n'
import { dryRun, finish, loadArchiveMetas, loadPlan, mediaBySeedKey } from './taxonomy'

const plan = loadPlan()
const metaTags = new Map([...loadArchiveMetas().values()].map(({ meta }) => [`archive/${meta.source}`, meta.tags as Partial<Record<Axis, string[]>>]))
guardTarget(dryRun)
const payload = await getPayload({ config: await config })
const tags: TagRef[] = (await payload.find({ collection: 'tags', locale: 'tr', pagination: false, limit: 0, depth: 0, select: { name: true, slug: true, axis: true } })).docs.map((t) => ({ id: t.id, axis: t.axis, slug: t.slug ?? '', name: t.name }))
const axisOf = new Map(tags.map((t) => [t.id, t.axis]))
const media = await mediaBySeedKey(payload, { tags: true })

const counts = { tagged: 0, added: 0, unchanged: 0 }
const missing: string[] = []
const unmapped = new Map<string, number>()
const failed: string[] = []
for (const [seedKey, facts] of Object.entries(plan.facts)) {
  const doc = media.get(seedKey)
  if (!doc) {
    missing.push(seedKey)
    continue
  }
  const currentIds = (doc.tags ?? []).map((t) => (typeof t === 'number' ? t : t.id))
  const r = tagIdsToAdd(facts, metaTags.get(seedKey), tags, currentIds.map((id) => ({ id, axis: axisOf.get(id) ?? '' })))
  for (const u of r.unmapped) unmapped.set(u, (unmapped.get(u) ?? 0) + 1)
  if (!r.add.length) {
    counts.unchanged++
    continue
  }
  try {
    if (!dryRun) await payload.update({ collection: 'media', id: doc.id, data: { tags: [...currentIds, ...r.add] }, context: seedCtx() })
    counts.tagged++
    counts.added += r.add.length
  } catch (err) {
    failed.push(seedKey)
    console.error(`${seedKey}: ${err instanceof Error ? err.message : err}`)
  }
}
finish(
  `taxonomy tags: ${counts.added} tag(s) added to ${counts.tagged} photo(s), ${counts.unchanged} unchanged, ${missing.length} not in this database (of ${Object.keys(plan.facts).length})`,
  [
    ['no matching tag (value × photos)', [...unmapped].sort((a, b) => b[1] - a[1]).map(([v, n]) => `${v} ×${n}`)],
    ['not in this database', missing],
  ],
  failed,
)
