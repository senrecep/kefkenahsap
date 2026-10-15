import { describe, expect, it } from 'vitest'

import {
  can3d,
  hasWoodSamples,
  keyRotation,
  MAX_TILT,
  rotate,
  shownSamples,
  WOOD_SAMPLES,
  fitDistance,
} from './samples'

describe('WOOD_SAMPLES', () => {
  it('lists the four species of PLAN §6 F2; only real-photo textures are shown (no drawn wood, DESIGN.md)', () => {
    expect(WOOD_SAMPLES.map((s) => s.key)).toEqual(['iroko', 'teak', 'cam', 'thermowood'])
    expect(shownSamples().map((s) => [s.key, s.texture, s.photo])).toEqual([
      // #146: each texture names its source job photo (gallery page by SEO filename, public/wood/PROVENANCE.txt).
      ['iroko', '/wood/iroko.webp', 'iroko-deck-zemin-ahsap-dolap-kapagi'],
      ['cam', '/wood/cam.webp', 'bahce-emprenyeli-cam-deck-zemin'],
    ])
  })
})

describe('hasWoodSamples', () => {
  const block = (blockType: string) => ({ type: 'block', fields: { blockType } })
  const doc = (...children: object[]) => ({ root: { type: 'root', children } })
  it('is true only when the body holds a woodSamples block, at any depth', () => {
    expect(hasWoodSamples(doc({ type: 'paragraph', children: [] }, block('woodSamples')))).toBe(
      true,
    )
    expect(
      hasWoodSamples(
        doc({ type: 'list', children: [{ type: 'listitem', children: [block('woodSamples')] }] }),
      ),
    ).toBe(true)
    expect(
      hasWoodSamples(
        doc(block('other'), {
          type: 'paragraph',
          children: [{ type: 'text', text: 'woodSamples' }],
        }),
      ),
    ).toBe(false)
    expect(hasWoodSamples(null)).toBe(false)
  })
})

describe('can3d', () => {
  const ok = { webgl: true, reducedMotion: false, saveData: false, deviceMemory: 8 }
  it('loads the 3D view only with WebGL, motion allowed, no Save-Data and enough memory', () => {
    expect(can3d(ok)).toBe(true)
    expect(can3d({ ...ok, webgl: false })).toBe(false)
    expect(can3d({ ...ok, reducedMotion: true })).toBe(false)
    expect(can3d({ ...ok, saveData: true })).toBe(false)
    expect(can3d({ ...ok, deviceMemory: 2 })).toBe(false)
  })
  it('treats an unknown device memory (Safari, Firefox) as enough', () => {
    expect(can3d({ ...ok, deviceMemory: undefined })).toBe(true)
  })
})

describe('keyRotation', () => {
  it('maps arrow keys to a 15° step and ignores other keys', () => {
    const step = Math.PI / 12
    expect(keyRotation('ArrowLeft')).toEqual({ x: 0, y: -step })
    expect(keyRotation('ArrowRight')).toEqual({ x: 0, y: step })
    expect(keyRotation('ArrowUp')).toEqual({ x: -step, y: 0 })
    expect(keyRotation('ArrowDown')).toEqual({ x: step, y: 0 })
    expect(keyRotation('Enter')).toBeNull()
  })
})

describe('rotate', () => {
  it('spins freely around y and clamps the tilt so the face never turns away', () => {
    expect(rotate({ x: 0, y: 0 }, { x: 0.1, y: 7 })).toEqual({ x: 0.1, y: 7 })
    expect(rotate({ x: 1, y: 0 }, { x: 1, y: 0 })).toEqual({ x: MAX_TILT, y: 0 })
    expect(rotate({ x: -1, y: 0 }, { x: -1, y: 0 })).toEqual({ x: -MAX_TILT, y: 0 })
  })
})

describe('fitDistance (#156: the plank fills its tile at rest)', () => {
  const board = { width: 4, height: 0.22, depth: 0.5 }
  it('face-on in a 3:1 tile, width-limited: the near corners span 85% of the width', () => {
    // Hand: x_ndc = 2 / ((d − 0.25) · tan 10° · 3) = 0.85 → d = 0.25 + 2 / (0.85 · 0.176327 · 3) = 4.6981.
    expect(fitDistance(board, { x: 0, y: 0 }, 3)).toBeCloseTo(4.6981, 3)
  })
  it('in a very wide tile, height-limited: the thickness spans 85% of the height', () => {
    // Hand: y_ndc = 0.11 / ((d − 0.25) · tan 10°) = 0.85 → d = 0.25 + 0.11 / (0.85 · 0.176327) = 0.9839 (x_ndc 0.77 then).
    expect(fitDistance(board, { x: 0, y: 0 }, 20)).toBeCloseTo(0.9839, 3)
  })
})
