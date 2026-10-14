import { describe, expect, it } from 'vitest'

import { homeSections } from './sections'

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
