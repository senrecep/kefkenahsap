import { describe, expect, it } from 'vitest'

import { galleryTagRows } from './tag-rows'

const tag = (id: number, slug: string, axis: string) => ({ id, slug, name: slug, axis })
const tags = [
  tag(1, 'kopek-kulubesi', 'type'),
  tag(2, 'pergola', 'type'),
  tag(3, 'iroko', 'wood'),
  tag(4, 'bahce', 'setting'),
  tag(5, 'bank', 'type'),
]
// Each inner array is one approved photo's tag ids.
const photos = (id: number, n: number) => Array.from({ length: n }, () => [id])
const slugs = (xs: { slug: string }[]) => xs.map((x) => x.slug)

describe('galleryTagRows', () => {
  it('shows a product type from 5 approved photos, not at 4', () => {
    const rows = galleryTagRows(tags, [...photos(1, 5), ...photos(2, 4)])
    expect(slugs(rows.types)).toEqual(['kopek-kulubesi'])
  })

  it('counts a photo once per tag it carries', () => {
    const rows = galleryTagRows(
      tags,
      Array.from({ length: 5 }, () => [1, 2, 3]),
    )
    expect(slugs(rows.types)).toEqual(['kopek-kulubesi', 'pergola'])
  })

  it('keeps the active type visible below the threshold, so it can be cleared', () => {
    expect(slugs(galleryTagRows(tags, photos(2, 1), 'pergola').types)).toEqual(['pergola'])
  })

  it('puts every other axis in the tag row, under the same 5-photo rule', () => {
    const rows = galleryTagRows(tags, [...photos(3, 5), ...photos(4, 4)])
    expect(slugs(rows.others)).toEqual(['iroko'])
  })

  it('keeps an active tag of another axis visible below the threshold', () => {
    expect(slugs(galleryTagRows(tags, [], 'bahce').others)).toEqual(['bahce'])
  })

  it('keeps the input order', () => {
    expect(slugs(galleryTagRows(tags, [...photos(5, 6), ...photos(1, 5)]).types)).toEqual([
      'kopek-kulubesi',
      'bank',
    ])
  })
})
