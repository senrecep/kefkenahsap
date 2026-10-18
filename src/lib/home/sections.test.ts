import { describe, expect, it } from 'vitest'

import { firstHero, homeSections } from './sections'

describe('homeSections', () => {
  it('falls back to the default order when the admin has not set up the homepage', () => {
    const order = ['hero', 'featuredGallery', 'services', 'featuredProjects', 'process', 'references', 'woodTypes', 'faq', 'contact']
    expect(homeSections(undefined).map((b) => b.blockType)).toEqual(order)
    expect(homeSections([]).map((b) => b.blockType)).toEqual(order)
  })

  it('keeps the saved order and drops disabled blocks', () => {
    const layout = [
      { blockType: 'contact', enabled: true },
      { blockType: 'hero', enabled: false },
      { blockType: 'services' },
      { blockType: 'faq', enabled: null },
    ]
    expect(homeSections(layout).map((b) => b.blockType)).toEqual(['contact', 'services', 'faq'])
  })

  it('shows nothing when every saved block is turned off', () => {
    expect(homeSections([{ blockType: 'hero', enabled: false }])).toEqual([])
  })
})

describe('firstHero (the one hero that carries the page h1)', () => {
  it('is the first enabled hero, in the saved order', () => {
    expect(firstHero(homeSections([{ blockType: 'hero', enabled: false }, { blockType: 'services' }, { blockType: 'hero' }, { blockType: 'hero' }]))).toBe(1)
  })
  it('is -1 when no hero renders, so the page supplies its own h1', () => {
    expect(firstHero(homeSections([{ blockType: 'services' }, { blockType: 'hero', enabled: false }]))).toBe(-1)
    expect(firstHero(homeSections([{ blockType: 'hero', enabled: false }]))).toBe(-1)
  })
  it('is the default hero for an unconfigured homepage', () => {
    expect(firstHero(homeSections(undefined))).toBe(0)
  })
})
