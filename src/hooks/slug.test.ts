import { describe, expect, it } from 'vitest'

import { validSlug } from './slug'

describe('validSlug (localized slug fields)', () => {
  it('accepts lowercase Latin letters, digits and dashes, and an empty value (filled from the title)', () => {
    expect(validSlug('ahsap-deck-2')).toBe(true)
    expect(validSlug('')).toBe(true)
    expect(validSlug(null)).toBe(true)
  })
  it('rejects anything else with a Turkish message (e.g. an Arabic slug the auto-fill could not transliterate)', () => {
    for (const v of ['أرضيات', 'Deck', 'deck ve zemin', 'köprü', 'a_b']) expect(validSlug(v), v).toMatch(/küçük Latin harf/)
  })
})
