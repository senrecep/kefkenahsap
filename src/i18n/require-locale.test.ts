import { describe, expect, it } from 'vitest'

import { requireLocale } from './require-locale'

describe('requireLocale', () => {
  it('returns the params with a valid locale', async () => {
    expect(await requireLocale(Promise.resolve({ locale: 'de', slug: 'x' }))).toEqual({ locale: 'de', slug: 'x' })
  })

  it.each(['.svn', 'foo', 'TR', ''])('rejects %j with notFound', async (locale) => {
    await expect(requireLocale(Promise.resolve({ locale }))).rejects.toMatchObject({ digest: expect.stringContaining('NEXT_HTTP_ERROR_FALLBACK;404') })
  })
})
