import sharp from 'sharp'

/** Open Graph card: a real photo cropped to 1200×630 (no generated text art). */
export const OG_SIZE = { width: 1200, height: 630 }
export const OG_CONTENT_TYPE = 'image/jpeg'

export async function ogPhoto(url: string | null | undefined): Promise<Response> {
  const res = url ? await fetch(url).catch(() => null) : null
  // A missing photo still yields a valid card (plain paper colour) rather than a broken og:image.
  const img = res?.ok
    ? sharp(Buffer.from(await res.arrayBuffer())).resize(OG_SIZE.width, OG_SIZE.height, { fit: 'cover' })
    : sharp({ create: { ...OG_SIZE, channels: 3, background: '#fbfaf7' } })
  const body = new Uint8Array(await img.jpeg({ quality: 82, mozjpeg: true }).toBuffer())
  return new Response(body, { headers: { 'Content-Type': OG_CONTENT_TYPE, 'Cache-Control': 'public, max-age=86400' } })
}
