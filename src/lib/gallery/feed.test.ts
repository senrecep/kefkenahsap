import { describe, expect, it } from 'vitest'

import { diversify } from './curate'
import { encodeCursor, galleryWhere, PAGE_SIZE, parseGalleryQuery, START_CURSOR_ID } from './query'

// The unfiltered gallery: page 1 is the curated selection, later pages walk the rest newest-first by id cursor.
type Item = { id: number; cat: string; featured: boolean }
const CATS = ['mobilya', 'boya', 'deck', 'pergola', 'kopru']
// Newest (highest ids) are all mobilya/boya, like the seed.
const all: Item[] = Array.from({ length: 100 }, (_, i) => {
  const id = 100 - i
  return { id, cat: id > 60 ? CATS[id % 2]! : CATS[id % 5]!, featured: id === 7 || id === 33 }
})
const rank = (g: string) => ({ deck: 0, pergola: 1, kopru: 2 })[g] ?? 100
const firstPage = () => diversify(all, { group: (x) => x.cat, rank, featured: (x) => x.featured }).slice(0, PAGE_SIZE)

// Evaluates the id conditions galleryWhere emits (the other clauses are status/category filters, all true here).
type IdCond = { less_than?: number; not_in?: number[] }
const matches = (where: ReturnType<typeof galleryWhere>, item: Item) =>
  where.and.every((c) => {
    const id = (c as { id?: IdCond }).id
    if (!id) return true
    return (id.less_than === undefined || item.id < id.less_than) && (id.not_in === undefined || !id.not_in.includes(item.id))
  })

describe('curated first page + cursor feed', () => {
  it('serves every approved item exactly once across page 1 and the following pages', () => {
    const page1 = firstPage()
    const exclude = page1.map((x) => x.id)
    const seen = [...page1]
    let cursor = START_CURSOR_ID
    for (let guard = 0; guard < 20; guard++) {
      const batch = all.filter((x) => matches(galleryWhere({ cursor, exclude }), x)).slice(0, PAGE_SIZE)
      seen.push(...batch)
      if (batch.length < PAGE_SIZE) break
      cursor = batch.at(-1)!.id
    }
    expect(seen).toHaveLength(all.length)
    expect(seen.map((x) => x.id).sort((a, b) => a - b)).toEqual(all.map((x) => x.id).sort((a, b) => a - b))
  })

  it('leads with featured, then outdoor categories, max 2 per category in the first 12', () => {
    const page1 = firstPage()
    expect(page1.slice(0, 2).map((x) => x.id)).toEqual([33, 7])
    expect(page1.slice(2, 5).map((x) => x.cat)).toEqual(['deck', 'pergola', 'kopru'])
    const head = page1.slice(0, 12)
    for (const c of CATS) expect(head.filter((x) => x.cat === c && !x.featured).length).toBeLessThanOrEqual(2)
  })

  it('is deterministic', () => {
    expect(firstPage()).toEqual(firstPage())
  })

  it('the start cursor is a valid cursor and includes the newest item', () => {
    const r = parseGalleryQuery({ cursor: encodeCursor(START_CURSOR_ID) })
    expect(r.ok && r.value.cursor).toBe(START_CURSOR_ID)
    expect(Math.max(...all.map((x) => x.id))).toBeLessThan(START_CURSOR_ID)
  })

  it('adds no exclusion when nothing is curated', () => {
    expect(JSON.stringify(galleryWhere({ exclude: [] }))).not.toContain('not_in')
  })
})
