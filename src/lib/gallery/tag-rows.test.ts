import { describe, expect, it } from 'vitest'

import { galleryTagRows, tagCategories } from './tag-rows'

const tag = (id: number, slug: string, axis: string) => ({ id, slug, name: slug, axis })
const tags = [
  tag(1, 'kopek-kulubesi', 'type'),
  tag(2, 'pergola', 'type'),
  tag(3, 'iroko', 'wood'),
  tag(4, 'bahce', 'setting'),
  tag(5, 'bank', 'type'),
]
// n approved photos in `category`, each carrying `ids`.
const photos = (ids: number | number[], n: number, category: number | null = 1) =>
  Array.from({ length: n }, () => ({ category, tags: typeof ids === 'number' ? [ids] : ids }))
const slugs = (xs: { slug: string }[]) => xs.map((x) => x.slug)

describe('galleryTagRows', () => {
  it('shows a product type from 5 approved photos, not at 4', () => {
    const rows = galleryTagRows(tags, [...photos(1, 5), ...photos(2, 4)])
    expect(slugs(rows.types)).toEqual(['kopek-kulubesi'])
  })

  it('counts a photo once per tag it carries', () => {
    const rows = galleryTagRows(tags, photos([1, 2, 3, 1], 5))
    expect(slugs(rows.types)).toEqual(['kopek-kulubesi', 'pergola'])
  })

  it('keeps the active type visible below the threshold, so it can be cleared', () => {
    expect(slugs(galleryTagRows(tags, photos(2, 1), { active: 'pergola' }).types)).toEqual(['pergola'])
  })

  it('puts every other axis in the tag row, under the same 5-photo rule, in input order', () => {
    const rows = galleryTagRows(tags, [...photos(4, 9), ...photos(3, 5), ...photos(4, 0)])
    expect(slugs(rows.others)).toEqual(['iroko', 'bahce'])
    expect(slugs(galleryTagRows(tags, [...photos(3, 5), ...photos(4, 4)]).others)).toEqual(['iroko'])
  })

  it('keeps an active tag of another axis visible below the threshold', () => {
    expect(slugs(galleryTagRows(tags, [], { active: 'bahce' }).others)).toEqual(['bahce'])
  })

  it('sorts product types by photo count, ties in input order', () => {
    const rows = galleryTagRows(tags, [...photos(1, 5), ...photos(5, 9), ...photos(2, 5)])
    expect(slugs(rows.types)).toEqual(['bank', 'kopek-kulubesi', 'pergola'])
  })

  it('shows the most common `top` types and moves the rest behind "more", in input (alphabetical) order to scan', () => {
    const rows = galleryTagRows(tags, [...photos(1, 5), ...photos(5, 9), ...photos(2, 6)], { top: 1 })
    expect(slugs(rows.types)).toEqual(['bank'])
    expect(slugs(rows.moreTypes)).toEqual(['kopek-kulubesi', 'pergola'])
  })

  it('keeps the active type in the visible row even when it ranks below `top`', () => {
    const rows = galleryTagRows(tags, [...photos(1, 5), ...photos(5, 9), ...photos(2, 6)], { top: 1, active: 'kopek-kulubesi' })
    expect(slugs(rows.types)).toEqual(['bank', 'kopek-kulubesi'])
    expect(slugs(rows.moreTypes)).toEqual(['pergola'])
  })

  it('with a service selected, counts only that service: types below 5 there are left out', () => {
    const all = [...photos(1, 5, 7), ...photos(2, 3, 7), ...photos(2, 9, 8), ...photos(3, 5, 8)]
    const rows = galleryTagRows(tags, all, { category: 7 })
    expect(slugs(rows.types)).toEqual(['kopek-kulubesi'])
    expect(rows.others).toEqual([])
    // Without a service the same photos add up across services.
    expect(slugs(galleryTagRows(tags, all).types)).toEqual(['pergola', 'kopek-kulubesi'])
  })

  it('with a service selected, still keeps the active tag so it can be cleared', () => {
    const rows = galleryTagRows(tags, photos(4, 9, 8), { category: 7, active: 'bahce' })
    expect(slugs(rows.others)).toEqual(['bahce'])
  })
})

describe('tagCategories', () => {
  it('lists the services that have at least one approved photo with the tag, each once', () => {
    const all = [...photos([4, 1], 2, 7), ...photos(1, 3, 8), ...photos(4, 1, 9), ...photos(4, 1, null)]
    expect(tagCategories(all, 4).sort()).toEqual([7, 9])
    expect(tagCategories(all, 99)).toEqual([])
  })
})
