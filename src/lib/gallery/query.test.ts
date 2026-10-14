import { describe, expect, it } from 'vitest'

import { encodeCursor, galleryWhere, MAX_PAGES, parseGalleryQuery } from './query'

const ok = (q: Record<string, string | string[] | undefined>) => {
  const r = parseGalleryQuery(q)
  if (!r.ok) throw new Error(r.errors[0]!.description)
  return r.value
}
const failCode = (q: Record<string, string | string[] | undefined>) => {
  const r = parseGalleryQuery(q)
  return r.ok ? null : r.errors[0]!.code
}

describe('parseGalleryQuery', () => {
  it('defaults to the first page with no filters', () => {
    expect(ok({})).toEqual({ page: 1 })
  })

  it('reads filters, page and cursor from the URL', () => {
    expect(ok({ kategori: 'deck-ve-zeminler', etiket: 'iroko', sayfa: '3', cursor: encodeCursor(412) })).toEqual({
      category: 'deck-ve-zeminler',
      tag: 'iroko',
      page: 3,
      cursor: 412,
    })
  })

  it('ignores empty values and takes the first of repeated params', () => {
    expect(ok({ kategori: '', etiket: ['teak', 'iroko'] })).toEqual({ tag: 'teak', page: 1 })
  })

  it('clamps the no-JS page count', () => {
    expect(ok({ sayfa: '999' }).page).toBe(MAX_PAGES)
    expect(ok({ sayfa: '0' }).page).toBe(1)
    expect(ok({ sayfa: 'abc' }).page).toBe(1)
  })

  it('rejects a malformed cursor or slug', () => {
    expect(failCode({ cursor: 'abc' })).toBe('Gallery.BadCursor')
    expect(failCode({ cursor: encodeCursor(0) })).toBe('Gallery.BadCursor')
    expect(failCode({ kategori: '../admin' })).toBe('Gallery.BadFilter')
  })

  it('cursor round-trips and is opaque', () => {
    const c = encodeCursor(1234)
    expect(c).not.toContain('1234')
    expect(ok({ cursor: c }).cursor).toBe(1234)
  })
})

describe('galleryWhere', () => {
  it('always limits the public gallery to approved images', () => {
    expect(galleryWhere({})).toEqual({ and: [{ status: { equals: 'approved' } }] })
  })

  it('adds category, tag and keyset (id below the cursor) conditions', () => {
    expect(galleryWhere({ categoryId: 174, tagId: 5, cursor: 300 })).toEqual({
      and: [
        { status: { equals: 'approved' } },
        { category: { equals: 174 } },
        { tags: { in: [5] } },
        { id: { less_than: 300 } },
      ],
    })
  })
})
