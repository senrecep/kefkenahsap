import { describe, expect, it } from 'vitest'

import { metaDescription } from './meta'

describe('metaDescription', () => {
  it('keeps whole sentences that fit the limit', () => {
    expect(metaDescription('Bir iki üç. Dört beş. Altı yedi sekiz dokuz on.', 22)).toBe('Bir iki üç. Dört beş.')
  })
  it('cuts a too-long first sentence at a word boundary with an ellipsis', () => {
    expect(metaDescription('İroko ve teak dış mekâna uygun sert ağaçlardır.', 20)).toBe('İroko ve teak dış…')
  })
  it('returns short text unchanged and empty for nothing', () => {
    expect(metaDescription('Kısa.', 160)).toBe('Kısa.')
    expect(metaDescription(undefined, 160)).toBe('')
  })
})
