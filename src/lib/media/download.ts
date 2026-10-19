import sharp from 'sharp'
import { Err } from 'tsentials/errors'
import { Result } from 'tsentials/result'

import { slugify } from '@/lib/slug'

import { stemOf } from './seoName'

/** #230: "İndir" in the admin. The stored original already carries the watermark (#204), so it is only re-encoded. */

/** `<seoFilename or stored stem>.jpg`, ASCII only so it is safe in a Content-Disposition header. */
export function downloadFilename(doc: { id: number | string; filename?: string | null; seoFilename?: string | null }): string {
  const slug = (s?: string | null) => {
    const r = s?.trim() ? slugify(s, 80) : null
    return r?.ok ? r.value : ''
  }
  return `${slug(doc.seoFilename) || slug(doc.filename && stemOf(doc.filename)) || `kefken-ahsap-${doc.id}`}.jpg`
}

/** Instagram-friendly JPEG at the stored size: sRGB, quality 90, no EXIF/ICC (sharp drops metadata unless asked to keep it). */
export async function toDownloadJpeg(bytes: Uint8Array): Promise<Result<Buffer>> {
  return Result.tryAsync(
    () => sharp(bytes).flatten({ background: '#ffffff' }).toColourspace('srgb').jpeg({ quality: 90, mozjpeg: true }).toBuffer(),
    (e) => Err.unexpected('Media.EncodeFailed', String(e)),
  )
}
