// #65/#175: creates one archive photo (seed/media-meta-archive) as a Media record, shared by archive.ts and taxonomy-import.ts.
import { copyFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import type { Payload } from 'payload'
import sharp from 'sharp'

import { verifyStored } from './verify-stored'

export type ArchiveMeta = {
  source: string // "<archive folder>/<file>"
  title: { tr: string; en: string }
  alt: { tr: string; en: string }
  caption: { tr: string; en: string }
  seoFilename: string
  tags: Record<string, string[]>
  categoryAgrees: boolean
  confidence: number
  model: string
  promptVersion: string
  generatedAt: string
}

// Keyed on the archive path, not the target category, so a photo filed under another category stays one record.
export const archiveSeedKey = (meta: Pick<ArchiveMeta, 'source'>) => `archive/${meta.source}`

// A fresh context per call: Payload keeps per-operation state in it. skipAi: the metadata is already here, never queue tagImage.
export const seedCtx = () => ({ skipAi: true })

/** The stored file is the uploaded source: fetched back from the bucket, its size and uniqueness checked (verify-stored.ts). */
export async function verifyArchiveFile(stored: string, src: string, servedDigests: Map<string, string>) {
  const { width = 0, height = 0 } = await sharp(src).metadata()
  await verifyStored(stored, src, { width, height }, servedDigests)
}

/**
 * Uploads `src` with the meta's TR/EN texts. `stamp`: the file has no watermark yet, so the upload hook stamps it once;
 * otherwise it is declared 'already' marked (pipeline images, #169). The SEO file name gets -2, -3… when `usedNames` has
 * it. Created `pending`; `status` is written last, once the EN texts are in and the stored file is fetched back and
 * checked, so a run that dies half-way never leaves a published photo behind. An unverified record is deleted.
 */
export async function createArchiveMedia(
  payload: Payload,
  meta: ArchiveMeta,
  opts: { src: string; categoryId: number; status: 'pending' | 'approved'; stamp: boolean; tmp: string; usedNames: Set<string>; servedDigests: Map<string, string> },
): Promise<number> {
  let name = meta.seoFilename
  for (let n = 2; opts.usedNames.has(name); n++) name = `${meta.seoFilename}-${n}`
  opts.usedNames.add(name)
  const upload = path.join(opts.tmp, `${name}${path.extname(opts.src)}`)
  copyFileSync(opts.src, upload)
  try {
    const { source: _source, generatedAt, ...suggestion } = meta
    const doc = await payload.create({
      collection: 'media',
      locale: 'tr',
      context: seedCtx(),
      filePath: upload,
      data: {
        seedKey: archiveSeedKey(meta),
        ...(opts.stamp ? {} : { watermark: 'already' as const }),
        category: opts.categoryId,
        status: 'pending',
        title: meta.title.tr,
        alt: meta.alt.tr,
        caption: meta.caption.tr,
        seoFilename: name,
        // Same shape the runtime tagImage job writes: an unreviewed suggestion, shown as "Onay bekliyor" in the Galeri.
        aiSuggestion: { ...suggestion, at: generatedAt },
      },
    })
    try {
      await payload.update({ collection: 'media', id: doc.id, locale: 'en', context: seedCtx(), data: { title: meta.title.en, alt: meta.alt.en, caption: meta.caption.en } })
      const stored = doc.filename ?? ''
      if (stored !== `${name}.webp`) throw new Error(`stored as ${stored}, expected ${name}.webp`)
      if (opts.stamp && doc.watermark !== 'applied') throw new Error(`expected a stamped upload, got watermark=${doc.watermark}`)
      await verifyArchiveFile(stored, upload, opts.servedDigests)
    } catch (err) {
      await payload.delete({ collection: 'media', id: doc.id, context: seedCtx() })
      throw err
    }
    if (opts.status !== 'pending') await payload.update({ collection: 'media', id: doc.id, data: { status: opts.status }, context: seedCtx() })
    return doc.id
  } finally {
    rmSync(upload, { force: true })
  }
}
