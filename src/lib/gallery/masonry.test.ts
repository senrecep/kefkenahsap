import { describe, expect, it } from 'vitest'

import { balanceColumns, distribute, evenColumns, largestFirstScreenItem, trimColumns } from './masonry'

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

describe('balanceColumns (#156: a fixed grid evens its columns by moving photos, not hiding them)', () => {
  const r = (ratio: number) => ({ width: 100, height: ratio * 100 })
  const sum = (items: { width: number; height: number }[], col: number[], gap = 0) => col.reduce((h, i) => h + items[i]!.height / items[i]!.width + gap, 0)

  it('moves a tile from the tallest column when that evens the grid', () => {
    // Greedy: c0 = 0,2,4 (1 + 0.5 + 2 = 3.5), c1 = 1,3,5 (1 + 0.5 + 0.5 = 2). Moving tile 2 (0.5) across gives 3 / 2.5.
    const items = [1, 1, 0.5, 0.5, 2, 0.5].map(r)
    expect(distribute(items, 2)).toEqual([[0, 2, 4], [1, 3, 5]])
    expect(balanceColumns(items, distribute(items, 2), 0)).toEqual([[0, 4], [1, 2, 3, 5]])
  })

  it('takes the best single move, else a swap when no move helps', () => {
    const items = [1, 1, 2, 1.5, 0.5].map(r)
    // c0 = 0,2,3 (1 + 2 + 1.5 = 4.5), c1 = 1,4 (1.5). Moving 3 gives 3 / 3; moving 2 only 2.5 / 3.5.
    expect(balanceColumns(items, [[0, 2, 3], [1, 4]], 0)).toEqual([[0, 2], [1, 3, 4]])
    // c0 = 0,2,4 (1 + 1.5 + 1.5 = 4), c1 = 1,3,5 (3): any move flips the gap to 2; swapping a 1.5 for a 1 gives 3.5 / 3.5
    // (the first such pair in feed order: 2 for 3).
    const swap = [1, 1, 1.5, 1, 1.5, 1].map(r)
    expect(balanceColumns(swap, [[0, 2, 4], [1, 3, 5]], 0)).toEqual([[0, 3, 4], [1, 2, 5]])
  })

  it("never moves a column's first tile, keeps feed order in each column and loses no tile", () => {
    const items = [1.33, 0.75, 1.33, 0.56, 1.33, 0.75, 0.75, 1.33, 0.56, 0.75, 0.56, 0.75, 1.33, 0.75, 0.56, 1.33].map(r)
    for (const n of [2, 3, 4]) {
      const before = distribute(items, n)
      const after = balanceColumns(items, before)
      expect(after.map((c) => c[0])).toEqual(before.map((c) => c[0]))
      for (const c of after) expect([...c].sort((a, b) => a - b)).toEqual(c)
      expect(after.flat().sort((a, b) => a - b)).toEqual(items.map((_, i) => i))
      const range = (cols: number[][]) => Math.max(...cols.map((c) => sum(items, c, 0.05))) - Math.min(...cols.map((c) => sum(items, c, 0.05)))
      expect(range(after)).toBeLessThanOrEqual(range(before))
    }
  })
})

describe('evenColumns (#156: the homepage grid, a fixed set)', () => {
  const r = (ratio: number) => ({ width: 100, height: ratio * 100 })

  it('keeps every photo where trimming alone would hide one', () => {
    // Greedy: c0 = 0,2,4 (1 + 1 + 2 = 4), c1 = 1,3 (2). Trimming alone drops tile 4; moving tile 2 across gives 3 / 3.
    const items = [1, 1, 1, 1, 2].map(r)
    expect(trimColumns(items, distribute(items, 2))).toEqual([[0, 2], [1, 3]])
    expect(evenColumns(items, distribute(items, 2), 0)).toEqual([[0, 4], [1, 2, 3]])
  })

  it('ends no more ragged than trimming alone, hiding no more photos, on a mixed set at 2, 3 and 4 columns', () => {
    const items = [1.33, 0.75, 1.33, 0.56, 1.33, 0.75, 0.75, 1.33, 0.56, 0.75, 0.56, 0.75, 1.33, 0.75, 0.56, 1.33].map(r)
    const edge = (cols: number[][]) => {
      const h = cols.map((c) => c.reduce((s, i) => s + items[i]!.height / items[i]!.width + 0.05, 0))
      return Math.max(...h) - Math.min(...h)
    }
    for (const n of [2, 3, 4]) {
      const plain = trimColumns(items, distribute(items, n))
      const even = evenColumns(items, distribute(items, n))
      expect(edge(even)).toBeLessThanOrEqual(edge(plain))
      expect(even.flat().length).toBeGreaterThanOrEqual(plain.flat().length)
    }
  })

  it('never hides more photos than trimming alone (review of #161), over many mixed sets', () => {
    let seed = 7
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31
    const ratios = [0.5625, 0.75, 1, 1.33]
    for (let t = 0; t < 200; t++) {
      const items = Array.from({ length: 16 }, () => r(ratios[Math.floor(rnd() * ratios.length)]!))
      for (const n of [2, 3, 4]) expect(evenColumns(items, distribute(items, n)).flat().length).toBeGreaterThanOrEqual(trimColumns(items, distribute(items, n)).flat().length)
    }
  })
})
