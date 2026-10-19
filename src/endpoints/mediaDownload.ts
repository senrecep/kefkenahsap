import type { Endpoint } from 'payload'

import { roleOf } from '@/access'
import { positiveId } from '@/ai/guard'
import { createLimiter, downloadFilename, toDownloadJpeg } from '@/lib/media/download'
import { mediaBucket, readObject } from '@/lib/media/renameStored'

const NO_STORE = { 'Cache-Control': 'private, no-store' }
const fail = (status: number, message: string) => Response.json({ message }, { status, headers: NO_STORE })
// Each encode holds a full-size decode in memory: two at a time per process.
const encodes = createLimiter(2)

/**
 * GET /api/media/:id/download (#230): "İndir" in Galeri and the media edit view. Staff only. The stored original (already
 * watermarked, #204) read from the bucket and re-encoded as a JPEG attachment. Only the `media` collection: lead photos
 * live elsewhere (private volume) and are never reachable here.
 */
export const mediaDownloadEndpoint: Endpoint = {
  path: '/:id/download',
  method: 'get',
  handler: async (req) => {
    if (!req.user) return fail(401, 'Bu işlem için yönetim paneline giriş yapın.')
    if (!roleOf(req.user)) return fail(403, 'Bu işlem için yetkiniz yok.')
    const id = positiveId(req.routeParams?.id)
    const doc = id === undefined ? null : await req.payload.findByID({ collection: 'media', id, depth: 0, disableErrors: true, req })
    if (!doc?.filename) return fail(404, 'Fotoğraf bulunamadı; silinmiş olabilir.')
    const { s3, bucket } = mediaBucket()
    const jpeg = await encodes(async () => {
      const bytes = await readObject(s3, bucket, doc.prefix, doc.filename!)
      return bytes.ok ? toDownloadJpeg(bytes.value) : bytes
    })
    if (!jpeg.ok) {
      const code = jpeg.errors[0]?.code
      req.payload.logger.error({ id, code, detail: jpeg.errors[0]?.description, msg: 'media download failed' })
      return code === 'Media.TooLarge' ? fail(413, 'Fotoğraf indirilemeyecek kadar büyük.') : fail(500, 'Fotoğraf indirilemedi. Tekrar deneyin.')
    }
    return new Response(jpeg.value, {
      headers: {
        ...NO_STORE,
        'Content-Type': 'image/jpeg',
        'Content-Length': String(jpeg.value.length),
        'Content-Disposition': `attachment; filename="${downloadFilename({ id: doc.id, filename: doc.filename, seoFilename: doc.seoFilename })}"`,
      },
    })
  },
}
