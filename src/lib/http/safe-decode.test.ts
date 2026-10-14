import { describe, expect, it } from 'vitest'

import { safeDecode } from './safe-decode'

describe('safeDecode', () => {
  it('decodes percent-encoded Turkish slugs', () => {
    expect(safeDecode('k%C3%B6pr%C3%BC')).toBe('köprü')
  })
  it('turns a malformed escape into notFound()', () => {
    expect(() => safeDecode('%E0%A4%A')).toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/)
  })
})
