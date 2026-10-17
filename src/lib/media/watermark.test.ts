import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { applyWatermark, cleanOriginal, fitFontSize, isStampable, watermarkAlphas, watermarkLayout } from './watermark'

// Expected sizes come from the pipeline itself: kefken-ahsap-image-pipeline/scripts/24_watermark.py `fit_font_size`
// run under Pillow 11 + raqm with FONT_PATH pointed at src/app/fonts/Montserrat.woff2 decompressed to TTF.
describe('fitFontSize (24_watermark.py fit_font_size)', () => {
  it.each([
    [2560, 1920, 81], // landscape phone photo: width-bound (0.34·√(w·h) = 754 px)
    [1920, 1080, 53],
    [2136, 4624, 116], // tall portrait: √(w·h) keeps it from reading too small
    [800, 600, 25],
    [1080, 1080, 40],
    [480, 360, 15],
    [200, 150, 14], // below the 14 px floor
    [100, 1000, 14],
  ])('%i×%i → %i px', (w, h, size) => {
    expect(fitFontSize(w, h)).toBe(size)
  })
})

describe('watermarkLayout', () => {
  it('stroke is size//22 (min 1), blur size//90 (min 1), text box = Pillow textbbox with the stroke', () => {
    // Pillow textbbox for these sizes: 745×83 (81 px), 1068×120 (116 px), 230×26 (25 px).
    expect(watermarkLayout(2560, 1920)).toEqual({ fontSize: 81, stroke: 3, blur: 1, textWidth: 745, textHeight: 83 })
    expect(watermarkLayout(2136, 4624)).toEqual({ fontSize: 116, stroke: 5, blur: 1, textWidth: 1068, textHeight: 120 })
    expect(watermarkLayout(800, 600)).toEqual({ fontSize: 25, stroke: 1, blur: 1, textWidth: 230, textHeight: 26 })
  })
})

describe('watermarkAlphas (background luma → fill/outline alpha)', () => {
  it.each([
    [0, 110, 50],
    [109.9, 110, 50], // dark: < 110
    [110, 95, 75], // mid-tone: 110…170 inclusive
    [170, 95, 75],
    [170.1, 75, 100], // bright: > 170
    [255, 75, 100],
  ])('luma %d → fill %i, outline %i', (luma, fill, outline) => {
    expect(watermarkAlphas(luma)).toEqual({ fill, outline })
  })
})

describe('applyWatermark', () => {
  const flat = (v: number, width = 800, height = 600) =>
    sharp({ create: { width, height, channels: 3, background: { r: v, g: v, b: v } } }).png().toBuffer()
  const centre = async (buf: Buffer) => {
    const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    const at = (x: number, y: number) => data[(y * info.width + x) * info.channels]!
    // Every pixel across the middle row where the text sits, and a corner far from it.
    const row = Array.from({ length: info.width }, (_, x) => at(x, Math.floor(info.height / 2)))
    return { row, corner: at(5, 5) }
  }

  it('marks the centre only, keeps size and format, lighter on dark and darker on bright', async () => {
    const marked = await applyWatermark(await flat(20), 'image/png')
    expect(await sharp(marked).metadata()).toMatchObject({ width: 800, height: 600, format: 'png' })
    const dark = await centre(marked)
    expect(dark.corner).toBe(20)
    expect(Math.max(...dark.row)).toBeGreaterThan(50) // white fill at 110/255 over 20 ≈ 98

    const bright = await centre(await applyWatermark(await flat(235), 'image/png'))
    expect(bright.corner).toBe(235)
    expect(Math.min(...bright.row)).toBeLessThan(200) // black outline at 100/255 over 235 ≈ 143
  })

  it('applies EXIF orientation before marking, so the text is upright in the stored image', async () => {
    const rotated = await sharp({ create: { width: 600, height: 800, channels: 3, background: { r: 20, g: 20, b: 20 } } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer()
    const out = await applyWatermark(rotated, 'image/jpeg')
    const meta = await sharp(out).metadata()
    expect([meta.width, meta.height, meta.orientation ?? 1]).toEqual([800, 600, 1])
  })

  it('an image narrower than the 14 px minimum text is still marked, without a full-size overlay error', async () => {
    const out = await applyWatermark(await flat(20, 60, 400), 'image/png')
    expect(await sharp(out).metadata()).toMatchObject({ width: 60, height: 400 })
    const row = (await centre(out)).row
    expect(Math.max(...row)).toBeGreaterThan(40)
  })
})

describe('isStampable', () => {
  const still = () => sharp({ create: { width: 40, height: 30, channels: 3, background: '#556' } }).webp().toBuffer()
  it('stamps still raster images only: no GIF/SVG, no animation', async () => {
    expect(await isStampable(await still(), 'image/webp')).toBe(true)
    expect(await isStampable(await still(), 'image/svg+xml')).toBe(false)
    // Two-frame 8×8 animated WebP written by Pillow (sharp's own animated join writes a single frame here).
    const animated = Buffer.from('UklGRoQAAABXRUJQVlA4WAoAAAACAAAABwAABwAAQU5JTQYAAAAAAAAAAABBTk1GKAAAAAAAAAAAAAcAAAcAAGQAAAJWUDhMDwAAAC8HwAEABxD9j/4HIqL/AQBBTk1GKAAAAAAAAAAAAAcAAAcAAGQAAABWUDhMDwAAAC8HwAEABxDR//4HIqL/AQA=', 'base64')
    expect(await isStampable(animated, 'image/webp')).toBe(false)
  })
})

describe('cleanOriginal', () => {
  const photo = (width: number, height: number) =>
    sharp({ create: { width, height, channels: 3, background: { r: 120, g: 90, b: 60 } } }).jpeg().toBuffer()
  const size = async (buf: Buffer) => {
    const meta = await sharp(buf).metadata()
    return [meta.width, meta.height, meta.format]
  }

  it.each([
    [4000, 3000, 2560, 1920], // long side over 2560 → downscaled, aspect kept
    [3000, 4000, 1920, 2560], // portrait: the long side is the height
    [2560, 1440, 2560, 1440], // exactly at the cap → untouched size
    [800, 600, 800, 600], // small → never upscaled
  ])('%i×%i → %i×%i WebP', async (w, h, ow, oh) => {
    expect(await size(await cleanOriginal(await photo(w, h)))).toEqual([ow, oh, 'webp'])
  })

  it('applies EXIF orientation and keeps the ICC profile', async () => {
    const rotated = await sharp({ create: { width: 600, height: 800, channels: 3, background: '#864' } })
      .withIccProfile('p3')
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer()
    const meta = await sharp(await cleanOriginal(rotated)).metadata()
    expect([meta.width, meta.height, meta.orientation ?? 1]).toEqual([800, 600, 1])
    expect(meta.icc).toBeDefined()
  })
})
