// #65/#175: creates one archive photo (seed/media-meta-archive) as a Media record, shared by archive.ts and taxonomy-import.ts.
import { copyFileSync } from 'node:fs'
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

/**
 * Uploads `src` with the meta's TR/EN texts. `stamp`: the file has no watermark yet, so the upload hook stamps it once;
 * otherwise it is declared 'already' marked (pipeline images, #169). The SEO file name gets -2, -3… when `usedNames` has
 * it. The stored file is fetched back and checked; an unverified record is deleted, or the next run would skip it.
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
  const { width = 0, height = 0 } = await sharp(upload).metadata()
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
      status: opts.status,
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
    await verifyStored(stored, upload, { width, height }, opts.servedDigests)
  } catch (err) {
    await payload.delete({ collection: 'media', id: doc.id, context: seedCtx() })
    throw err
  }
  return doc.id
}
