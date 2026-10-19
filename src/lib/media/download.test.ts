import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { createLimiter, downloadFilename, toDownloadJpeg } from './download'

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

  it('refuses an image over the pixel limit with Media.TooLarge (no decode of a pixel bomb)', async () => {
    const png = await sharp({ create: { width: 200, height: 100, channels: 3, background: '#000' } }).png().toBuffer()
    const r = await toDownloadJpeg(png, 19_999)
    expect(!r.ok && r.errors[0]?.code).toBe('Media.TooLarge')
    expect((await toDownloadJpeg(png, 20_000)).ok).toBe(true)
  })
})

describe('createLimiter (#230)', () => {
  it('runs at most n tasks at once and the rest in order as slots free up', async () => {
    const limit = createLimiter(2)
    const log: string[] = []
    const gates: Record<string, () => void> = {}
    const task = (name: string) =>
      limit(async () => {
        log.push(`start ${name}`)
        await new Promise<void>((r) => (gates[name] = r))
        log.push(`end ${name}`)
        return name
      })
    const all = Promise.all(['a', 'b', 'c', 'd'].map(task))
    await new Promise((r) => setTimeout(r, 0))
    expect(log).toEqual(['start a', 'start b'])
    gates.b!()
    await new Promise((r) => setTimeout(r, 0))
    expect(log).toEqual(['start a', 'start b', 'end b', 'start c'])
    gates.a!()
    await new Promise((r) => setTimeout(r, 0))
    gates.c!()
    await new Promise((r) => setTimeout(r, 0))
    gates.d!()
    expect(await all).toEqual(['a', 'b', 'c', 'd'])
  })

  it('frees the slot when a task throws', async () => {
    const limit = createLimiter(1)
    await expect(limit(async () => { throw new Error('x') })).rejects.toThrow('x')
    expect(await limit(async () => 'next')).toBe('next')
  })
})
