import { describe, expect, it } from 'vitest'

import { distribute, largestFirstScreenItem, trimColumns } from './masonry'

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

describe('largestFirstScreenItem (the phone grid\'s LCP card)', () => {
  it('picks the tallest card among the first rows of every column', () => {
    // columns: [0 landscape, 2 square], [1 portrait, 3 landscape] → item 1 (ratio 2)
    const items = [landscape, portrait, square, landscape]
    expect(largestFirstScreenItem(items, [[0, 2], [1, 3]], 2)).toBe(1)
  })
  it('breaks a tie by document order: earlier column first, then row', () => {
    // the gallery as measured: [landscape, portrait] | [portrait, landscape] → Chrome reports column 1's portrait
    const items = [landscape, portrait, portrait, landscape]
    expect(largestFirstScreenItem(items, [[0, 1], [2, 3]], 2)).toBe(1)
  })
  it('breaks a tie within one column by row', () => {
    expect(largestFirstScreenItem([portrait, portrait, landscape], [[0, 1], [2]], 2)).toBe(0)
  })
  it('treats a card without known size as square', () => {
    // square-equivalent unknown (ratio 1) beats landscape (0.5), loses to portrait (2)
    expect(largestFirstScreenItem([landscape, { width: null, height: null }], [[0], [1]], 1)).toBe(1)
    expect(largestFirstScreenItem([{ width: 0, height: 0 }, portrait], [[0], [1]], 1)).toBe(1)
  })
  it('ignores cards below the first rows', () => {
    expect(largestFirstScreenItem([square, landscape, portrait], [[0, 2], [1]], 1)).toBe(0)
  })
  it('is undefined for an empty grid', () => {
    expect(largestFirstScreenItem([], [[], []], 2)).toBeUndefined()
  })
})


describe('trimColumns (a fixed grid ends on an even line)', () => {
  // Heights in width units: square 1, landscape 0.5, portrait 2.
  it('drops a trailing tile that overhangs the shortest column', () => {
    // [square, portrait] = 3 vs [square] = 1 → dropping the portrait leaves 1 = 1
    expect(trimColumns([square, square, portrait], [[0, 2], [1]])).toEqual([[0], [1]])
  })
  it('keeps a tile when dropping it would not bring the column closer to the shortest', () => {
    // 1.5 vs 2: dropping item 3 gives 1, which is as far from 1.5 as 2 is → keep
    expect(trimColumns([square, square, landscape, square], [[0, 2], [1, 3]])).toEqual([[0, 2], [1, 3]])
  })
  it('drops several tiles from one column while each drop gets closer', () => {
    // [portrait, landscape, landscape] = 3 vs [portrait] = 2 → drop both landscapes (2.5 → 2)
    expect(trimColumns([portrait, portrait, landscape, landscape], [[0, 2, 3], [1]])).toEqual([[0], [1]])
  })
  it('never empties a column', () => {
    expect(trimColumns([portrait, landscape], [[0], [1]])).toEqual([[0], [1]])
  })
  it('leaves even columns alone', () => {
    expect(trimColumns([square, square, square], [[0], [1], [2]])).toEqual([[0], [1], [2]])
  })
})
