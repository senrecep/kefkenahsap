import { describe, expect, it } from 'vitest'

import { derivativeFilename, needsDerivative } from './derivative'

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
