import sharp from 'sharp'

/** Open Graph card: a real photo cropped to 1200×630 (no generated text art). */
export const OG_SIZE = { width: 1200, height: 630 }
export const OG_CONTENT_TYPE = 'image/jpeg'

const MAX_BYTES = 15 * 1024 * 1024
const MAX_PIXELS = 50_000_000 // ~7000×7000; a decompression bomb fails instead of exhausting memory

/** The photo at `url` as a 1200×630 JPEG, or null when it cannot be fetched or decoded in time. */
export async function ogJpeg(url: string | null | undefined, fetcher: typeof fetch = fetch): Promise<Uint8Array | null> {
  if (!url) return null
  try {
    const res = await fetcher(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok || Number(res.headers.get('content-length') ?? 0) > MAX_BYTES) return null
    const input = Buffer.from(await res.arrayBuffer())
    if (input.length > MAX_BYTES) return null
    const out = await sharp(input, { limitInputPixels: MAX_PIXELS })
      .resize(OG_SIZE.width, OG_SIZE.height, { fit: 'cover' })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer()
    return new Uint8Array(out)
  } catch {
    return null
  }
}

/**
 * A real photo is cached for a day. Without one, a plain paper-coloured card keeps og:image valid but is
 * never cached, so the photo appears as soon as it is reachable again.
 */
export async function ogResponse(photo: Uint8Array | null): Promise<Response> {
  if (photo) return new Response(photo, { headers: { 'Content-Type': OG_CONTENT_TYPE, 'Cache-Control': 'public, max-age=86400' } })
  const blank = await sharp({ create: { ...OG_SIZE, channels: 3, background: '#fbfaf7' } }).jpeg({ quality: 82 }).toBuffer()
  return new Response(new Uint8Array(blank), { headers: { 'Content-Type': OG_CONTENT_TYPE, 'Cache-Control': 'no-store' } })
}
