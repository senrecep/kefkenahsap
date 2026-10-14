// #138: guide links in a body are recognised in every locale's guide path, so unpublished ones render as plain text.
import { describe, expect, it } from 'vitest'

import { isGuideLink } from './links'

describe('isGuideLink', () => {
  it.each(['/tr/rehber/deck-bakimi', '/en/guides/deck-care', '/ru/stati/ukhod-za-dekom', '/de/ratgeber/deck-pflege', '/ar/guides/al-ttiras'])('%s is a guide link', (url) => {
    expect(isGuideLink(url)).toBe(true)
  })

  it.each([
    '/ru/derevyannye-konstruktsii', // a category
    '/ru/stati', // the guide index
    '/ru/guides/x', // another locale's segment
    '/tr/guides/x',
    '/ru/stati/x/y',
    '/ru/stati/x#faq',
    'https://example.com/ru/stati/x',
  ])('%s is not', (url) => {
    expect(isGuideLink(url)).toBe(false)
  })
})
