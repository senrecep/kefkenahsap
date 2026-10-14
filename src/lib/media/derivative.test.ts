import { describe, expect, it } from 'vitest'

import sharp from 'sharp'

import { coverResize, cropAroundFocalPoint, derivativeFilename, focalBox, needsDerivative } from './derivative'

describe('derivativeFilename', () => {
  // Payload names sizes `<name>-<width>x<height>.<ext>` (e.g. bahce-zemin-kat-ahsap-deck-960x720.webp in the seed).
  it('appends the size before the extension', () => {
    expect(derivativeFilename('bahce-zemin-kat-ahsap-deck.webp', 480, 360)).toBe('bahce-zemin-kat-ahsap-deck-480x360.webp')
  })
  it('keeps dots inside the name', () => {
    expect(derivativeFilename('a.b.webp', 480, 640)).toBe('a.b-480x640.webp')
  })
})

describe('needsDerivative', () => {
  const doc = { filename: 'x.webp', width: 1600, sizes: { w480: { filename: null } } }
  it('is needed when the size is missing and the original is wider', () => {
    expect(needsDerivative(doc, 'w480', 480)).toBe(true)
  })
  it('is skipped once the size exists (idempotent)', () => {
    expect(needsDerivative({ ...doc, sizes: { w480: { filename: 'x-480x270.webp' } } }, 'w480', 480)).toBe(false)
  })
  it('is skipped when the original is not wider (sizes never enlarge)', () => {
    expect(needsDerivative({ ...doc, width: 480 }, 'w480', 480)).toBe(false)
    expect(needsDerivative({ ...doc, width: null }, 'w480', 480)).toBe(false)
  })
  it('is skipped without an original file', () => {
    expect(needsDerivative({ ...doc, filename: null }, 'w480', 480)).toBe(false)
  })
})

describe('coverResize', () => {
  // Payload scales to cover the box first: by height when the source is wider than the box, else by width.
  it('scales a landscape by height and a tall source by width', () => {
    expect(coverResize({ width: 2560, height: 1920 }, { width: 400, height: 711 })).toEqual({ height: 711 })
    expect(coverResize({ width: 1000, height: 2000 }, { width: 400, height: 711 })).toEqual({ width: 400 })
  })
})

describe('focalBox', () => {
  // Bounds come from the size sharp actually produced (2560x1920 at height 711 → 948x711), not a prediction.
  it('centres the cut on the focal point', () => {
    expect(focalBox({ width: 948, height: 711 }, { width: 400, height: 711 }, { x: 50, y: 50 })).toEqual({ left: 274, top: 0, width: 400, height: 711 })
  })
  it('keeps the box inside the image near an edge', () => {
    expect(focalBox({ width: 948, height: 711 }, { width: 400, height: 711 }, { x: 98, y: 50 }).left).toBe(548)
    expect(focalBox({ width: 948, height: 711 }, { width: 400, height: 711 }, { x: 2, y: 50 }).left).toBe(0)
    // 3920x1440 resizes to 1935 wide (not the 1936 a rounding guess gives): the box must end at 1935.
    expect(focalBox({ width: 1935, height: 711 }, { width: 400, height: 711 }, { x: 100, y: 50 }).left).toBe(1535)
  })
  it('cuts vertically on a tall source', () => {
    expect(focalBox({ width: 400, height: 800 }, { width: 400, height: 711 }, { x: 50, y: 50 })).toEqual({ left: 0, top: 44, width: 400, height: 711 })
  })
})

describe('cropAroundFocalPoint', () => {
  it('crops a 3920x1440 source at focal x=100 without an out-of-bounds extract', async () => {
    const input = await sharp({ create: { width: 3920, height: 1440, channels: 3, background: '#886644' } }).webp().toBuffer()
    const { info } = await cropAroundFocalPoint(input, { width: 400, height: 711, quality: 70 }, { x: 100, y: 50 })
    expect([info.width, info.height, info.format]).toEqual([400, 711, 'webp'])
  })
})
