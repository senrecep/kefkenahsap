import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { ogJpeg, ogResponse } from './og-image'

const webp = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 120, g: 80, b: 40 } } }).webp().toBuffer()
const respond = (body: BodyInit | null, init?: ResponseInit) => (async () => new Response(body, init)) as unknown as typeof fetch

describe('ogJpeg', () => {
  it('crops a photo to a 1200×630 JPEG', async () => {
    const out = await ogJpeg('https://cdn/x.webp', respond(new Uint8Array(await webp(1030, 579))))
    const meta = await sharp(out!).metadata()
    expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', 1200, 630])
  })

  it('a failed fetch, an error status, an oversized body or an undecodable file → null', async () => {
    const reject = (async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch
    expect(await ogJpeg('https://cdn/x.webp', reject)).toBeNull()
    expect(await ogJpeg('https://cdn/x.webp', respond(null, { status: 404 }))).toBeNull()
    expect(await ogJpeg('https://cdn/x.webp', respond('x', { headers: { 'content-length': String(16 * 1024 * 1024) } }))).toBeNull()
    expect(await ogJpeg('https://cdn/x.webp', respond('not an image'))).toBeNull()
    expect(await ogJpeg(null)).toBeNull()
  })
})

describe('ogResponse', () => {
  it('a photo is cached for a day', async () => {
    const res = await ogResponse(new Uint8Array([1, 2, 3]))
    expect(res.headers.get('cache-control')).toBe('public, max-age=86400')
  })

  it('the fallback card is a valid 1200×630 JPEG that is never cached', async () => {
    const res = await ogResponse(null)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('content-type')).toBe('image/jpeg')
    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata()
    expect([meta.width, meta.height]).toEqual([1200, 630])
  })
})
