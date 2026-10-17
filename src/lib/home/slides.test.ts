import { describe, expect, it } from 'vitest'

import { fillHeroSlides, heroSlides, MAX_SLIDES } from './slides'

const m = (id: number) => ({ id, url: `/m/${id}.webp`, width: 2560, height: 1440 })

describe('heroSlides (what the homepage hero shows, in order)', () => {
  it('starts with the hero image and follows with the slides in their saved order', () => {
    expect(heroSlides(m(1), [m(3), m(2)]).map((s) => s.id)).toEqual([1, 3, 2])
  })

  it('is just the hero image without slides (the single photo of before)', () => {
    expect(heroSlides(m(1), null).map((s) => s.id)).toEqual([1])
    expect(heroSlides(m(1), []).map((s) => s.id)).toEqual([1])
  })

  it('skips slides read as a bare id (a photo the public may not see) and empty entries', () => {
    expect(heroSlides(m(1), [7, null, m(4)]).map((s) => s.id)).toEqual([1, 4])
  })

  it('shows a photo once, even when it is also the hero image or listed twice', () => {
    expect(heroSlides(m(1), [m(1), m(5), m(5)]).map((s) => s.id)).toEqual([1, 5])
  })

  it('lets the slides carry the show when the hero image is missing', () => {
    expect(heroSlides(null, [m(5), m(6)]).map((s) => s.id)).toEqual([5, 6])
    expect(heroSlides(null, [])).toEqual([])
  })

  it(`stops at ${MAX_SLIDES} photos`, () => {
    const many = Array.from({ length: 12 }, (_, i) => m(10 + i))
    expect(heroSlides(m(1), many)).toHaveLength(MAX_SLIDES)
  })
})

describe('fillHeroSlides (seed: only an empty slide list of the first hero)', () => {
  const layout = [
    { id: 'a', blockType: 'services' },
    { id: 'b', blockType: 'hero', image: 1, slides: [] },
    { id: 'c', blockType: 'hero', image: 2, slides: [] },
  ]

  it('fills the first hero, leaving out its own image, and keeps every other block as is', () => {
    const r = fillHeroSlides(layout, [9, 1, 8])
    expect(r.filled).toBe(true)
    expect(r.layout).toEqual([layout[0], { id: 'b', blockType: 'hero', image: 1, slides: [9, 8] }, layout[2]])
  })

  it('never touches slides the owner already set, nor a layout without a hero', () => {
    const owned = [{ id: 'b', blockType: 'hero', image: 1, slides: [4] }]
    expect(fillHeroSlides(owned, [9])).toEqual({ layout: owned, filled: false })
    expect(fillHeroSlides([{ id: 'a', blockType: 'faq' }], [9]).filled).toBe(false)
  })

  it('reads a populated hero image (an object) as its id', () => {
    const r = fillHeroSlides([{ id: 'b', blockType: 'hero', image: { id: 9 } }], [9, 8])
    expect(r.layout[0]!.slides).toEqual([8])
  })

  it('keeps the total within the slide limit', () => {
    const r = fillHeroSlides([{ id: 'b', blockType: 'hero', image: 1 }], Array.from({ length: 12 }, (_, i) => 10 + i))
    expect(r.layout[0]!.slides).toHaveLength(MAX_SLIDES - 1)
  })
})
