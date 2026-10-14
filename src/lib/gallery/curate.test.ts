import { describe, expect, it } from 'vitest'

import { categoryRank, diversify, pickCover } from './curate'

type P = { id: string; cat: string; featured?: boolean }
const p = (id: string, cat: string, featured = false): P => ({ id, cat, featured })
const opts = (rank: Record<string, number>) => ({ group: (x: P) => x.cat, rank: (g: string) => rank[g] ?? 99, featured: (x: P) => Boolean(x.featured) })
const ids = (xs: P[]) => xs.map((x) => x.id)

describe('diversify', () => {
  it('puts featured photos first, then one per category in rank order', () => {
    const items = [p('a1', 'a'), p('b1', 'b'), p('a2', 'a'), p('f', 'b', true), p('c1', 'c')]
    expect(ids(diversify(items, opts({ c: 0, a: 1, b: 2 })))).toEqual(['f', 'c1', 'a1', 'b1', 'a2'])
  })

  it('keeps the input order inside a category and ties on rank by first appearance', () => {
    const items = [p('x1', 'x'), p('y1', 'y'), p('x2', 'x'), p('y2', 'y')]
    expect(ids(diversify(items, opts({})))).toEqual(['x1', 'y1', 'x2', 'y2'])
  })

  it('allows at most `cap` per category in the head while other categories still have photos', () => {
    // 'a' has 5 photos, 'b' 1: round robin a1 b1 a2, then a is capped at 2 in the first 4 → relaxed only once nothing else is left
    const items = [p('a1', 'a'), p('a2', 'a'), p('a3', 'a'), p('a4', 'a'), p('a5', 'a'), p('b1', 'b')]
    const out = diversify(items, { ...opts({ a: 0, b: 1 }), cap: 2, head: 4 })
    expect(ids(out)).toEqual(['a1', 'b1', 'a2', 'a3', 'a4', 'a5'])
    expect(out).toHaveLength(items.length)
  })

  it('caps a category inside the head of a realistic mix', () => {
    const items = Array.from({ length: 40 }, (_, i) => p(`p${i}`, ['deck', 'deck', 'deck', 'mobilya', 'pergola'][i % 5]!))
    const head = diversify(items, { ...opts({ deck: 0, pergola: 1 }), cap: 2, head: 6 }).slice(0, 6)
    const count = (c: string) => head.filter((x) => x.cat === c).length
    expect([count('deck'), count('pergola'), count('mobilya')]).toEqual([2, 2, 2])
  })

  it('is deterministic and loses nothing', () => {
    const items = [p('1', 'a'), p('2', 'b', true), p('3', 'a'), p('4', 'c'), p('5', 'b')]
    const a = diversify(items, opts({ b: 0 }))
    expect(a).toEqual(diversify([...items], opts({ b: 0 })))
    expect(ids(a).sort()).toEqual(['1', '2', '3', '4', '5'])
  })
})

describe('categoryRank', () => {
  it('ranks outdoor categories first, the rest after them in saved order', () => {
    const rank = categoryRank(['mobilya-ve-cila', 'pergola-ve-kamelyalar', 'merdivenler', 'deck-ve-zeminler'])
    expect(['deck-ve-zeminler', 'pergola-ve-kamelyalar', 'mobilya-ve-cila', 'merdivenler', 'unknown'].map(rank)).toEqual([0, 1, 100, 102, 1000])
  })
})

describe('pickCover', () => {
  const photo = (id: number, width: number, height: number, status = 'approved') => ({ id, width, height, status })
  it('uses an approved cover when set', () => {
    expect(pickCover(photo(9, 800, 1200), [photo(1, 1600, 1000)])?.id).toBe(9)
  })
  it('ignores an unapproved or unpopulated cover', () => {
    expect(pickCover(photo(9, 1600, 1000, 'pending'), [photo(1, 1600, 1000)])?.id).toBe(1)
    expect(pickCover(9, [photo(1, 1600, 1000)])?.id).toBe(1)
  })
  it('falls back to the first landscape photo at least 1280 wide, in the given order', () => {
    expect(pickCover(null, [photo(1, 1000, 700), photo(2, 1280, 1600), photo(3, 1280, 960), photo(4, 1920, 1080)])?.id).toBe(3)
  })
  it('takes the first photo when none is large and landscape, nothing when there are none', () => {
    expect(pickCover(undefined, [photo(2, 900, 1600), photo(3, 640, 480)])?.id).toBe(2)
    expect(pickCover(undefined, [])).toBeUndefined()
  })
})
