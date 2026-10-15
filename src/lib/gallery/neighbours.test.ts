import { describe, expect, it } from 'vitest'

import { neighbours } from './neighbours'

const a = { slug: 'a' }
const b = { slug: 'b' }
const c = { slug: 'c' }

describe('neighbours (prev/next on an image page, in the category order)', () => {
  it('returns the items on either side', () => {
    expect(neighbours([a, b, c], 'b')).toEqual({ prev: a, next: c })
  })
  it('has no prev on the first item and no next on the last (no wrap-around)', () => {
    expect(neighbours([a, b, c], 'a')).toEqual({ prev: undefined, next: b })
    expect(neighbours([a, b, c], 'c')).toEqual({ prev: b, next: undefined })
  })
  it('has neither for a single item or a slug that is not in the list', () => {
    expect(neighbours([a], 'a')).toEqual({ prev: undefined, next: undefined })
    expect(neighbours([a, b], 'x')).toEqual({ prev: undefined, next: undefined })
    expect(neighbours([], 'a')).toEqual({ prev: undefined, next: undefined })
  })
})
