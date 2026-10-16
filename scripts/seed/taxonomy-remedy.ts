// #175: replaces the files of the live photos that show stacked watermarks (photo-plan.json `remedies`, from
// image-work/remedies.json) with the better source the review found, keeping the record (id, texts, tags, category, order).
// - A twin from kefken-data, or a WP original that still has one mark: already single-marked, so it is uploaded without
//   a stamp (skipWatermark, then watermark back to 'already' in a second, file-less update).
// - A fully clean WP original (`stamp`): the upload hook stamps it once ('applied', the clean original kept privately).
// A file is replaced only while the record still holds the exact file the plan was made from (filename + size), so a
// re-run, or a file the owner has replaced since, is left alone and listed. After each replacement the stored file and
// every size are fetched back from the CDN bucket and checked.
// --dry-run writes nothing; a non-local database needs --yes; SITE_ENV=production is refused.
// KEFKEN_WORKSPACE = the folder holding kefken-data/ and image-work/ (default ../..).
// Run: bun run payload run scripts/seed/taxonomy-remedy.ts [-- --dry-run | --yes]
import { copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { getPayload } from 'payload'
import sharp from 'sharp'

import config from '@/payload.config'
import { remedyDue } from '@/lib/media/taxonomy'
import { mediaFileURL } from '@/lib/media/url'

import { seedCtx } from './archive-media'
import { guardTarget } from './i18n'
import { dry, dryRun, finish, loadPlan, mediaBySeedKey, WORKSPACE } from './taxonomy'

const plan = loadPlan()
guardTarget(dryRun)
if (!dryRun && !process.env.MEDIA_PUBLIC_URL) throw new Error('MEDIA_PUBLIC_URL is not set: cannot fetch the replaced files to verify them')
const payload = await getPayload({ config: await config })
const media = await mediaBySeedKey(payload, { filename: true, filesize: true })
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

const counts = { replaced: 0, stamped: 0 }
const notPlanned: string[] = []
const replaced: string[] = []
const failed: string[] = []
try {
  for (const r of plan.remedies) {
    const doc = media.get(r.seedKey)
    if (!doc || !remedyDue({ filename: doc.filename, filesize: doc.filesize }, r.current)) {
      notPlanned.push(`${r.seedKey} (${doc ? `${doc.filename}, ${doc.filesize} B` : 'not in this database'})`)
      continue
    }
    try {
      const src = path.resolve(WORKSPACE, r.source)
      if (!existsSync(src)) throw new Error(`missing source ${src}`)
      console.log(`${dry}${r.seedKey}: ${r.source}${r.stamp ? ' (stamped once)' : ' (already marked, no stamp)'}`)
      if (dryRun) {
        counts.replaced++
        if (r.stamp) counts.stamped++
        continue
      }
      const upload = path.join(tmp, `${path.parse(doc.filename!).name}${path.extname(src).toLowerCase()}`)
      copyFileSync(src, upload)
      const { width, height, orientation } = await sharp(upload).metadata()
      await payload.update({ collection: 'media', id: doc.id, filePath: upload, data: r.stamp ? {} : { skipWatermark: true }, context: seedCtx() })
      if (!r.stamp) await payload.update({ collection: 'media', id: doc.id, data: { watermark: 'already' }, context: seedCtx() })
      const { doc: after, files } = await verifyServed(doc.id)
      const expected = r.stamp ? 'applied' : 'already'
      if (after.watermark !== expected) throw new Error(`watermark ${after.watermark}, expected ${expected}`)
      // EXIF orientation 5–8 is stored rotated (width and height swap).
      const [w, h] = (orientation ?? 1) >= 5 ? [height, width] : [width, height]
      if (after.width !== w || after.height !== h) throw new Error(`stored ${after.width}×${after.height}, source ${w}×${h}`)
      replaced.push(`${r.seedKey}: ${doc.filename} → ${after.filename} (${after.width}×${after.height}, ${files} files, ${after.watermark})`)
      counts.replaced++
      if (r.stamp) counts.stamped++
    } catch (err) {
      failed.push(r.seedKey)
      console.error(`${r.seedKey}: ${err instanceof Error ? err.message : err}`)
    }
  }
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
finish(
  `taxonomy remedy: ${counts.replaced} replaced (${counts.stamped} stamped once), ${notPlanned.length} not the planned file (of ${plan.remedies.length})`,
  [
    ['replaced', replaced],
    ['not the planned file (replaced already, or by the owner), left as is', notPlanned],
  ],
  failed,
)
