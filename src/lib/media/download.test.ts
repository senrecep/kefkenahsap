import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { downloadFilename, toDownloadJpeg } from './download'

describe('downloadFilename (#230)', () => {
  it('uses the SEO filename, as ASCII, with .jpg', () => {
    expect(downloadFilename({ id: 7, filename: 'IMG_0042.webp', seoFilename: 'Kompozit Deck Şile' })).toBe('kompozit-deck-sile.jpg')
  })

  it('falls back to the stored filename stem, then the id', () => {
    expect(downloadFilename({ id: 7, filename: 'ahsap-pergola-2.webp', seoFilename: '  ' })).toBe('ahsap-pergola-2.jpg')
    expect(downloadFilename({ id: 7, filename: null, seoFilename: null })).toBe('kefken-ahsap-7.jpg')
  })
})

describe('toDownloadJpeg (#230)', () => {
  it('re-encodes the stored file as an sRGB JPEG at full size without metadata', async () => {
    const webp = await sharp({ create: { width: 1234, height: 567, channels: 4, background: { r: 120, g: 90, b: 60, alpha: 0.5 } } })
      .webp()
      .withExif({ IFD0: { Copyright: 'secret-camera' } })
      .toBuffer()
    const r = await toDownloadJpeg(webp)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const meta = await sharp(r.value).metadata()
    expect([meta.format, meta.width, meta.height, meta.space, meta.hasAlpha]).toEqual(['jpeg', 1234, 567, 'srgb', false])
    expect(meta.exif).toBeUndefined()
    expect(meta.icc).toBeUndefined()
    expect(Buffer.from(r.value).includes('secret-camera')).toBe(false)
  })

  it('fails with Media.EncodeFailed for bytes that are not an image', async () => {
    const r = await toDownloadJpeg(new Uint8Array([1, 2, 3]))
    expect(!r.ok && r.errors[0]?.code).toBe('Media.EncodeFailed')
  })
})
