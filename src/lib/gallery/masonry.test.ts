import { describe, expect, it } from 'vitest'

import { distribute } from './masonry'

// Ratios chosen so the hand-computed column heights are exact.
const landscape = { width: 400, height: 200 } // 0.5
const square = { width: 300, height: 300 } // 1
const portrait = { width: 200, height: 400 } // 2

describe('distribute (shortest column first)', () => {
  it('fills empty columns left to right, ties go to the lowest column', () => {
    expect(distribute([square, square, square, square], 3)).toEqual([[0, 3], [1], [2]])
  })

  it('places each item on the column that is shortest at that moment', () => {
    // heights after 0,1: [2, 0.5] → 2 to col 1 (0.5→1.5) → 3 to col 1 (1.5→2.5) → 4: [2, 2.5] → col 0
    expect(distribute([portrait, landscape, square, square, square], 2)).toEqual([[0, 4], [1, 2, 3]])
  })

  it('treats images without known size as square', () => {
    expect(distribute([portrait, { width: 0, height: 0 }, square], 2)).toEqual([[0], [1, 2]])
  })

  it('is stable across appends: earlier items never move when more arrive', () => {
    const items = Array.from({ length: 60 }, (_, i) => [landscape, square, portrait][(i * 7) % 3]!)
    for (const cols of [2, 3, 4]) {
      const first = distribute(items.slice(0, 24), cols)
      const all = distribute(items, cols)
      expect(all.map((c) => c.filter((i) => i < 24))).toEqual(first)
    }
  })

  it('is deterministic', () => {
    const items = [portrait, landscape, square, landscape, portrait]
    expect(distribute(items, 3)).toEqual(distribute([...items], 3))
  })
})
