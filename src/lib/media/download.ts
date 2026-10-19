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

/** Decode cap: 60 MP. The largest stored original today is ~8 MP (3264×2448); a phone's 48 MP shot still passes. */
export const MAX_INPUT_PIXELS = 60_000_000

/** Instagram-friendly JPEG at the stored size: sRGB, quality 90, no EXIF/ICC (sharp drops metadata unless asked to keep it). */
export async function toDownloadJpeg(bytes: Uint8Array, maxPixels = MAX_INPUT_PIXELS): Promise<Result<Buffer>> {
  return Result.tryAsync(
    () => sharp(bytes, { limitInputPixels: maxPixels }).flatten({ background: '#ffffff' }).toColourspace('srgb').jpeg({ quality: 90, mozjpeg: true }).toBuffer(),
    (e) => (/pixel limit/i.test(String(e)) ? Err.validation('Media.TooLarge', String(e)) : Err.unexpected('Media.EncodeFailed', String(e))),
  )
}

/** At most `n` tasks at once; the rest wait in order. shortcut: per process (like the AI rate limiter), not across replicas. */
export function createLimiter(n: number) {
  let active = 0
  const waiting: (() => void)[] = []
  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (active < n) active++
    else await new Promise<void>((r) => waiting.push(r)) // the finishing task hands its slot over
    try {
      return await task()
    } finally {
      const next = waiting.shift()
      if (next) next()
      else active--
    }
  }
}
