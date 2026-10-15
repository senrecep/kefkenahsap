import { describe, expect, it } from 'vitest'

import { relatedGuides } from './related'

const g = (id: number, categories: number[], updatedAt: string) => ({ id, categories, updatedAt })
// Newest first, as getGuides returns them.
const all = [
  g(1, [10], '2026-10-09'),
  g(2, [30], '2026-10-08'),
  g(3, [10, 20], '2026-10-07'),
  g(4, [20], '2026-10-06'),
  g(5, [], '2026-10-05'),
]

describe('relatedGuides', () => {
  it('never lists the guide itself; most shared categories first, then the newest', () => {
    expect(relatedGuides(all, 3, [10, 20]).map((x) => x.id)).toEqual([1, 4, 2])
  })

  it('falls back to the newest guides when none shares a category', () => {
    expect(relatedGuides(all, 1, [99]).map((x) => x.id)).toEqual([2, 3, 4])
  })

  it('returns at most `limit` and nothing when the guide is the only one', () => {
    expect(relatedGuides(all, 1, [10], 2).map((x) => x.id)).toEqual([3, 2])
    expect(relatedGuides([g(1, [10], '2026-10-09')], 1, [10])).toEqual([])
  })
})
