import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildAlternates, siteUrl } from './alternates'

const SITE = 'https://www.kefkenahsap.com'

describe('buildAlternates', () => {
  it('self-canonical per locale, hreflang for published locales, x-default = Turkish', () => {
    expect(buildAlternates({ current: 'en', paths: { tr: '/tr/deck-ve-zeminler', en: '/en/decking-and-flooring' }, site: SITE })).toEqual({
      canonical: `${SITE}/en/decking-and-flooring`,
      languages: {
        tr: `${SITE}/tr/deck-ve-zeminler`,
        en: `${SITE}/en/decking-and-flooring`,
        'x-default': `${SITE}/tr/deck-ve-zeminler`,
      },
    })
  })
  it('omits locales without a published translation (no hreflang to a missing page)', () => {
    const a = buildAlternates({ current: 'tr', paths: { tr: '/tr/projeler/x', en: null }, site: SITE })
    expect(Object.keys(a.languages)).toEqual(['tr', 'x-default'])
  })
})

describe('siteUrl', () => {
  afterEach(() => vi.unstubAllEnvs())
  it('uses NEXT_PUBLIC_SITE_URL', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://development.kefkenahsap.com')
    expect(siteUrl()).toBe('https://development.kefkenahsap.com')
  })
  it('missing outside production → throws instead of pointing canonicals at production', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    vi.stubEnv('SITE_ENV', 'development')
    expect(() => siteUrl()).toThrow(/NEXT_PUBLIC_SITE_URL/)
    vi.stubEnv('SITE_ENV', 'production')
    expect(siteUrl()).toBe('https://www.kefkenahsap.com')
  })
})
