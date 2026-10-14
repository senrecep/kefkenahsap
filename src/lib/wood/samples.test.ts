import { describe, expect, it } from 'vitest'

import { can3d, keyRotation, MAX_TILT, rotate, WOOD_SAMPLES } from './samples'

describe('WOOD_SAMPLES', () => {
  it('has the four species of PLAN §6 F2, each with a texture; only the photo-less ones are procedural', () => {
    expect(WOOD_SAMPLES.map((s) => s.key)).toEqual(['iroko', 'teak', 'cam', 'thermowood'])
    expect(WOOD_SAMPLES.filter((s) => s.procedural).map((s) => s.key)).toEqual([
      'teak',
      'thermowood',
    ])
    for (const s of WOOD_SAMPLES) expect(s.texture).toBe(`/wood/${s.key}.webp`)
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
