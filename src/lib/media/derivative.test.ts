import { describe, expect, it } from 'vitest'

import { derivativeFilename, focalCrop, needsDerivative } from './derivative'

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

describe('focalCrop', () => {
  // Same box Payload cuts at upload (createImageSizes, resizeWithFocalPoint): scale to cover, then centre on the focal point.
  it('scales a landscape to the target height and centres the cut on the focal point', () => {
    expect(focalCrop({ width: 2560, height: 1920 }, { width: 400, height: 711 }, { x: 50, y: 50 })).toEqual({
      resize: { height: 711 },
      extract: { left: 274, top: 0, width: 400, height: 711 },
    })
  })
  it('keeps the box inside the image when the focal point is near an edge', () => {
    expect(focalCrop({ width: 2560, height: 1920 }, { width: 400, height: 711 }, { x: 98, y: 50 }).extract.left).toBe(548)
    expect(focalCrop({ width: 2560, height: 1920 }, { width: 400, height: 711 }, { x: 2, y: 50 }).extract.left).toBe(0)
  })
  it('scales a taller-than-target source to the target width and cuts vertically', () => {
    expect(focalCrop({ width: 1000, height: 2000 }, { width: 400, height: 711 }, { x: 50, y: 50 })).toEqual({
      resize: { width: 400 },
      extract: { left: 0, top: 44, width: 400, height: 711 },
    })
  })
})

