import type { TaskConfig } from 'payload'

import { purgeURLs } from '@/collections/Media'
import { mediaPublicURLs } from '@/lib/media/cdn-purge'
import { anyExists, copyObjects, deleteObjects, mediaBucket, storedFiles } from '@/lib/media/renameStored'
import { needsSeoRename, pickSeoName, renamePlan, stemOf } from '@/lib/media/seoName'

/**
 * #209: gives an approved admin upload its SEO file name: the original and every size move to `<seoName>.<ext>` /
 * `<seoName>-<W>x<H>.<ext>`. Queued by Media's queueSeoRename (and by scripts/seed/seo-filenames.ts with `force` for hidden
 * photos). Order matters: copy -> point the document at the copies -> delete the old objects -> purge their CDN URLs.
 * A failure before the document is updated removes the copies and leaves everything as it was; the job is idempotent
 * (it re-reads the photo, and a renamed one no longer qualifies). Nothing is re-uploaded through Payload's upload
 * pipeline, so the watermark is not stamped again. The name is chosen against the bucket (HEAD of every target), so two
 * processes never overwrite each other's file. `_objectKey` (client-side uploads) is not used here: files sit at `<prefix>/<filename>`.
 */
export const seoRenameTask: TaskConfig<'seoRename'> = {
  slug: 'seoRename',
  retries: 1,
  inputSchema: [
    { name: 'mediaId', type: 'text', required: true },
    { name: 'force', type: 'checkbox' },
  ],
  outputSchema: [{ name: 'result', type: 'text' }],
  // Same key as tagImage/translateMedia: one job per photo at a time.
  concurrency: ({ input }) => `media:${input.mediaId}`,
  handler: async ({ input, req }) => {
    const { payload } = req
    const doc = await payload.findByID({ collection: 'media', id: input.mediaId, depth: 0, locale: 'tr', disableErrors: true, req })
    if (!doc) return { output: { result: 'Media.NotFound' } }
    if (!needsSeoRename(doc, { force: input.force === true })) return { output: { result: 'skipped' } }
    const filename = doc.filename!

    const first = pickSeoName({ seoFilename: doc.seoFilename, titleTr: doc.title, id: doc.id, taken: new Set() })
    const found = await payload.find({ collection: 'media', where: { filename: { contains: first } }, pagination: false, depth: 0, select: { filename: true }, req })
    const taken = new Set([...found.docs.filter((d) => d.id !== doc.id).map((d) => stemOf(d.filename ?? '')), ...((doc.seoRetiredStems as string[] | null) ?? [])])
    const { bucket, s3 } = mediaBucket()
    let name = pickSeoName({ seoFilename: doc.seoFilename, titleTr: doc.title, id: doc.id, taken })
    let plan = renamePlan({ filename, sizes: doc.sizes }, name)
    while (await anyExists(s3, bucket, doc.prefix, plan.moves.map((m) => m.to))) {
      taken.add(name)
      name = pickSeoName({ seoFilename: doc.seoFilename, titleTr: doc.title, id: doc.id, taken })
      plan = renamePlan({ filename, sizes: doc.sizes }, name)
    }

    const types = new Map(storedFiles(doc).map((f) => [f.filename, f.contentType]))
    const copied = await copyObjects(s3, bucket, doc.prefix, plan.moves.map((m) => ({ ...m, contentType: types.get(m.from) ?? doc.mimeType ?? 'image/webp' })))
    if (!copied.ok) throw new Error(copied.errors.map((e) => e.description).join('; '))

    const sizes = Object.fromEntries(Object.entries(doc.sizes ?? {}).map(([k, v]) => [k, plan.sizes[k] ? { ...v, filename: plan.sizes[k] } : v]))
    // Only if the file is still the one we copied: an admin save during the job must not be overwritten with stale data.
    let changed = 0
    try {
      const res = await payload.update({
        collection: 'media',
        where: { id: { equals: doc.id }, filename: { equals: filename } },
        locale: 'tr',
        data: { filename: plan.filename, sizes, seoRenamed: true, ...(doc.seoFilename?.trim() ? {} : { seoFilename: name }) },
        context: { skipAi: true, seoRenameJob: true },
        depth: 0,
        req,
      })
      changed = res.docs.length
      if (res.errors.length) throw new Error(res.errors.map((e) => e.message).join('; '))
    } catch (err) {
      await deleteObjects(s3, bucket, doc.prefix, plan.moves.map((m) => m.to))
      throw err
    }
    if (!changed) {
      await deleteObjects(s3, bucket, doc.prefix, plan.moves.map((m) => m.to))
      return { output: { result: 'aborted:changed' } } // the photo's file changed meanwhile; that save queued its own job
    }

    // The document points at the copies now; what is left of the old objects is garbage. Failures are only logged.
    const old = plan.moves.map((m) => m.from)
    const deleted = await deleteObjects(s3, bucket, doc.prefix, old)
    if (!deleted.ok) payload.logger.warn({ errors: deleted.errors, media: doc.id }, 'media: old objects not deleted after SEO rename')
    // The new URLs too: a 404 cached before the job ran would otherwise outlive it.
    const base = process.env.MEDIA_PUBLIC_URL ?? ''
    await purgeURLs(req, [...mediaPublicURLs({ filename, prefix: doc.prefix, sizes: doc.sizes }, base), ...mediaPublicURLs({ filename: plan.filename, prefix: doc.prefix, sizes: Object.fromEntries(Object.entries(plan.sizes).map(([k, f]) => [k, { filename: f }])) }, base)])
    return { output: { result: `renamed:${plan.filename}` } }
  },
}
