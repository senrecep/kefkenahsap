// #175: loads the Kaliteli archive photos of the owner-approved taxonomy (photo-plan.json `imports`, 2,686) with their
// tagImage metadata from seed/media-meta-archive (+ ru/de/ar overlays from seed/i18n). Owner decision (2026-10-16): all
// published, except the photos the tagger doubted (category disagrees, confidence ≤ 0.3), which stay `pending`.
// - A photo not in the database is created (archive-media.ts, keyed on its archive path) in its plan category. Files
//   carry the pipeline's mark already ('already'); the few the plan marks `stamp` are stamped once by the upload hook.
// - A photo already there (archive.ts made the first 210 pending in their old folder's category) moves to its plan
//   category while it is still in that folder's category, and a pending one is approved; a hidden one, or one the owner
//   filed elsewhere, is left as is and listed.
// - ru/de/ar title/alt/caption fill only empty fields (seedMediaLocales).
// A re-run writes nothing. --dry-run writes nothing; a non-local database needs --yes; SITE_ENV=production is refused.
// KEFKEN_ARCHIVE = the Kaliteli folder (default ../../kefken-data/Kaliteli); KEFKEN_CONCURRENCY uploads at once (4).
// Run: bun run payload run scripts/seed/taxonomy-import.ts [-- --dry-run | --yes]
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { importStatus } from '@/lib/media/taxonomy'

import { archiveSeedKey, createArchiveMedia, seedCtx } from './archive-media'
import { guardTarget, seedMediaLocales } from './i18n'
import { categoryIds, dry, dryRun, finish, loadArchiveMetas, loadPlan, mediaBySeedKey, SEED } from './taxonomy'

const ARCHIVE = process.env.KEFKEN_ARCHIVE ?? path.resolve(process.cwd(), '../../kefken-data/Kaliteli')
const CONCURRENCY = Number(process.env.KEFKEN_CONCURRENCY ?? 4)
const plan = loadPlan()
const metas = loadArchiveMetas()
guardTarget(dryRun)
const payload = await getPayload({ config: await config })
const cats = await categoryIds(payload)
const media = await mediaBySeedKey(payload, { category: true, status: true })
const idOf = (c: unknown) => (typeof c === 'object' && c ? (c as { id: number }).id : (c as number | null | undefined) ?? undefined)
const usedNames = new Set((await payload.find({ collection: 'media', pagination: false, limit: 0, depth: 0, select: { seoFilename: true } })).docs.map((d) => d.seoFilename).filter(Boolean) as string[])
const servedDigests = new Map<string, string>()
const tmp = mkdtempSync(path.join(os.tmpdir(), 'kefken-taxonomy-'))

const counts = { created: 0, updated: 0, unchanged: 0 }
const pending: string[] = []
const leftAsIs: string[] = []
const failed: string[] = []
const toCreate: (() => Promise<void>)[] = []
for (const imp of plan.imports) {
  const label = `archive/${imp.source}`
  const entry = metas.get(imp.source)
  if (!entry) {
    failed.push(`${label}: no meta in seed/media-meta-archive`)
    continue
  }
  const status = importStatus(entry.meta)
  if (status === 'pending') pending.push(`${label} → ${imp.category}`)
  const target = cats.get(imp.category)!
  const doc = media.get(archiveSeedKey(entry.meta))
  if (!doc) {
    const src = path.join(ARCHIVE, imp.source)
    toCreate.push(async () => {
      try {
        if (!existsSync(src)) throw new Error(`missing archive photo: ${src}`)
        if (!dryRun) await createArchiveMedia(payload, entry.meta, { src, categoryId: target, status, stamp: imp.stamp ?? false, tmp, usedNames, servedDigests })
        counts.created++
        if (counts.created % 100 === 0) console.log(`${dry}${counts.created} created`)
      } catch (err) {
        failed.push(label)
        console.error(`${label}: ${err instanceof Error ? err.message : err}`)
      }
    })
    continue
  }
  const data: { category?: number; status?: 'approved' } = {}
  const current = idOf(doc.category)
  if (current !== target) {
    if (current === cats.get(entry.dir)) data.category = target
    else leftAsIs.push(`${label} (category ${current ?? 'none'}, plan ${imp.category})`)
  }
  if (doc.status === 'pending' && status === 'approved') data.status = 'approved'
  else if (doc.status !== status && doc.status !== 'pending') leftAsIs.push(`${label} (${doc.status}, plan ${status})`)
  if (!Object.keys(data).length) {
    counts.unchanged++
    continue
  }
  try {
    console.log(`${dry}${label}: ${Object.entries(data).map(([k, v]) => `${k} → ${k === 'category' ? imp.category : v}`).join(', ')}`)
    if (!dryRun) await payload.update({ collection: 'media', id: doc.id, data, context: seedCtx() })
    counts.updated++
  } catch (err) {
    failed.push(label)
    console.error(`${label}: ${err instanceof Error ? err.message : err}`)
  }
}

try {
  console.log(`${dry}${toCreate.length} to create, ${CONCURRENCY} at a time`)
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    for (let job = toCreate.shift(); job; job = toCreate.shift()) await job()
  }))
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

const rels = plan.imports.map((i) => metas.get(i.source)?.rel).filter((r): r is string => Boolean(r))
const loc = await seedMediaLocales(payload, { seedDir: SEED, rels, dryRun })
failed.push(...loc.failed)
finish(
  `taxonomy import: ${counts.created} created, ${counts.updated} updated, ${counts.unchanged} unchanged (of ${plan.imports.length}); ${pending.length} pending; ru/de/ar: ${loc.writes} locale write(s) on ${loc.media} photo(s)`,
  [
    ['pending (the tagger doubted the category)', pending],
    ['owner-changed, left as is', leftAsIs],
  ],
  failed,
)
