// #175: replaces the files of the live photos that show stacked watermarks (photo-plan.json `remedies`, from
// image-work/remedies.json) with the better source the review found, keeping the record (id, texts, tags, category, order).
// - A twin from kefken-data, or a WP original that still has one mark: already single-marked, so it is uploaded without
//   a stamp (skipWatermark, then watermark back to 'already' in a second, file-less update).
// - A fully clean WP original (`stamp`): the upload hook stamps it once ('applied', the clean original kept privately).
// A file is replaced only while the record still holds the exact file the plan was made from (filename + size), so a
// re-run, or a file the owner has replaced since, is left alone and listed. After each replacement the stored file and
// every size are fetched back from the CDN bucket and checked; one that fails the check is listed as "replaced but
// unverified" (a re-run does not replace it again). An unstamped replacement whose 'already' write did not happen
// (watermark 'none', the source's size) is finished on the next run. A stamp keeps the clean original in
// MEDIA_ORIGINALS_DIR, which a run with a stamp due must set explicitly (docs/RUNBOOK.md).
// --dry-run writes nothing; a non-local database needs --yes; SITE_ENV=production is refused.
// KEFKEN_WORKSPACE = the folder holding kefken-data/ and image-work/ (default ../..).
// Run: bun run payload run scripts/seed/taxonomy-remedy.ts [-- --dry-run | --yes]
// A replaced file gets a new name (`<name>-1.webp`): run scripts/seed/legacy-maps.ts afterwards and commit the maps (#190).
import { copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { getPayload } from 'payload'
import sharp from 'sharp'

import config from '@/payload.config'
import { remedyDue, remedyUnfinished } from '@/lib/media/taxonomy'
import { mediaFileURL } from '@/lib/media/url'

import { seedCtx } from './archive-media'
import { guardTarget } from './i18n'
import { dry, dryRun, finish, loadPlan, mediaBySeedKey, requireDir, requireOriginalsDir, WORKSPACE } from './taxonomy'

requireDir('KEFKEN_WORKSPACE', WORKSPACE)

const plan = loadPlan()
guardTarget(dryRun)
if (!dryRun && !process.env.MEDIA_PUBLIC_URL) throw new Error('MEDIA_PUBLIC_URL is not set: cannot fetch the replaced files to verify them')
const payload = await getPayload({ config: await config })
const media = await mediaBySeedKey(payload, { filename: true, filesize: true, watermark: true, width: true, height: true })
requireOriginalsDir(plan.remedies.filter((r) => r.stamp && media.get(r.seedKey) && remedyDue(media.get(r.seedKey)!, r.current)).length)
const tmp = mkdtempSync(path.join(os.tmpdir(), 'kefken-remedy-'))

/** Every stored file of the record (main + sizes) is served with the recorded dimensions. */
async function verifyServed(id: number) {
  const doc = await payload.findByID({ collection: 'media', id, depth: 0 })
  const files = [{ filename: doc.filename, width: doc.width, height: doc.height }, ...Object.values(doc.sizes ?? {})].filter((f) => f?.filename)
  for (const f of files) {
    const res = await fetch(mediaFileURL(f!.filename!, doc.prefix ?? undefined))
    if (!res.ok) throw new Error(`${f!.filename}: served ${res.status}`)
    const got = await sharp(Buffer.from(await res.arrayBuffer())).metadata()
    if (got.width !== f!.width || got.height !== f!.height) throw new Error(`${f!.filename}: served ${got.width}×${got.height}, recorded ${f!.width}×${f!.height}`)
  }
  return { doc, files: files.length }
}

/** Source size as stored: EXIF orientation 5–8 is stored rotated (width and height swap). */
async function storedSize(src: string) {
  const { width = 0, height = 0, orientation } = await sharp(src).metadata()
  return (orientation ?? 1) >= 5 ? { width: height, height: width } : { width, height }
}

/** Every file served, and the record holds the source's size with the expected watermark state. */
async function verifyReplaced(id: number, size: { width: number; height: number }, stamp: boolean) {
  const { doc, files } = await verifyServed(id)
  const expected = stamp ? 'applied' : 'already'
  if (doc.watermark !== expected) throw new Error(`watermark ${doc.watermark}, expected ${expected}`)
  if (doc.width !== size.width || doc.height !== size.height) throw new Error(`stored ${doc.width}×${doc.height}, source ${size.width}×${size.height}`)
  return `${doc.filename} (${doc.width}×${doc.height}, ${files} files, ${doc.watermark})`
}

const counts = { replaced: 0, stamped: 0, finished: 0 }
const notPlanned: string[] = []
const replaced: string[] = []
const unverified: string[] = []
const failed: string[] = []
try {
  for (const r of plan.remedies) {
    const doc = media.get(r.seedKey)
    const src = path.resolve(WORKSPACE, r.source)
    if (!existsSync(src)) {
      failed.push(`${r.seedKey}: missing source ${src}`)
      continue
    }
    const size = await storedSize(src)
    // Recovery: replaced by an earlier run that died before writing 'already' back.
    if (doc && remedyUnfinished(doc, size, r.stamp)) {
      try {
        console.log(`${dry}${r.seedKey}: replaced earlier, watermark none → already`)
        if (!dryRun) {
          await payload.update({ collection: 'media', id: doc.id, data: { watermark: 'already' }, context: seedCtx() })
          replaced.push(`${r.seedKey}: finished, ${await verifyReplaced(doc.id, size, false)}`)
        }
        counts.finished++
      } catch (err) {
        unverified.push(`${r.seedKey}: ${err instanceof Error ? err.message : err}`)
      }
      continue
    }
    if (!doc || !remedyDue({ filename: doc.filename, filesize: doc.filesize }, r.current)) {
      notPlanned.push(`${r.seedKey} (${doc ? `${doc.filename}, ${doc.filesize} B, ${doc.watermark}` : 'not in this database'})`)
      continue
    }
    console.log(`${dry}${r.seedKey}: ${r.source}${r.stamp ? ' (stamped once)' : ' (already marked, no stamp)'}`)
    if (dryRun) {
      counts.replaced++
      if (r.stamp) counts.stamped++
      continue
    }
    const upload = path.join(tmp, `${path.parse(doc.filename!).name}${path.extname(src).toLowerCase()}`)
    try {
      copyFileSync(src, upload)
      await payload.update({ collection: 'media', id: doc.id, filePath: upload, data: r.stamp ? {} : { skipWatermark: true }, context: seedCtx() })
      if (!r.stamp) await payload.update({ collection: 'media', id: doc.id, data: { watermark: 'already' }, context: seedCtx() })
    } catch (err) {
      failed.push(r.seedKey)
      console.error(`${r.seedKey}: ${err instanceof Error ? err.message : err}`)
      continue
    } finally {
      rmSync(upload, { force: true })
    }
    counts.replaced++
    if (r.stamp) counts.stamped++
    try {
      replaced.push(`${r.seedKey}: ${doc.filename} → ${await verifyReplaced(doc.id, size, r.stamp)}`)
    } catch (err) {
      // The new file is in; a re-run will not replace it again (it is no longer the planned file), so it is listed apart.
      unverified.push(`${r.seedKey}: ${err instanceof Error ? err.message : err}`)
    }
  }
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
finish(
  `taxonomy remedy: ${counts.replaced} replaced (${counts.stamped} stamped once), ${counts.finished} earlier replacement(s) finished, ${unverified.length} replaced but unverified, ${notPlanned.length} not the planned file (of ${plan.remedies.length})`,
  [
    ['replaced', replaced],
    ['replaced but unverified (check these by hand)', unverified],
    ['not the planned file (replaced already, or by the owner), left as is', notPlanned],
  ],
  [...failed, ...unverified.map((u) => u.split(':')[0]!)],
)
