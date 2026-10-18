import { describe, expect, it } from 'vitest'

import { resultSections } from './sections'

const empty = { projects: [], guides: [], categories: [], media: [], tags: [] }

describe('resultSections (search page order + count, #147)', () => {
  it('orders projects, guides, services, photos and skips empty groups', () => {
    const r = resultSections({
      ...empty,
      media: [{ id: 1 }],
      categories: [{ id: 2, slug: 'deck-ve-zeminler' }],
      guides: [{ id: 3, slug: 'iroko-nedir', title: 'İroko nedir?' }],
      projects: [{ id: 4, slug: 'riva-iskele' }],
    })
    expect(r.sections.map((s) => s.key)).toEqual(['projects', 'guides', 'categories', 'media'])
    expect(r.total).toBe(4)

    expect(resultSections({ ...empty, media: [{ id: 1 }, { id: 2 }] }).sections.map((s) => s.key)).toEqual(['media'])
  })

  it('counts only what renders: items without a slug (or a guide without a title in this locale) and tags are dropped', () => {
    const r = resultSections({
      projects: [{ id: 1, slug: null }, { id: 2, slug: 'a' }],
      guides: [{ id: 3, slug: 'b', title: '' }, { id: 4, slug: null, title: 'X' }, { id: 5, slug: 'c', title: 'Y' }],
      categories: [{ id: 6, slug: null }],
      media: [],
      tags: [{ id: 7 }, { id: 8 }],
    })
    expect(r.sections).toEqual([
      { key: 'projects', items: [{ id: 2, slug: 'a' }] },
      { key: 'guides', items: [{ id: 5, slug: 'c', title: 'Y' }] },
    ])
    expect(r.total).toBe(2)
  })

  it('no hits → no sections and a zero total', () => {
    expect(resultSections(empty)).toEqual({ sections: [], total: 0 })
  })
})
