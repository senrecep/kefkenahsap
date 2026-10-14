import { createNavigation } from 'next-intl/navigation'
import { describe, expect, it } from 'vitest'

import { routing } from '@/i18n/routing'

import { localizedPathname } from './pathname'

const path = (args: Parameters<typeof localizedPathname>[1]) => localizedPathname(routing, args)

describe('localizedPathname', () => {
  it('prefixes every locale and drops the root slash', () => {
    expect(path({ locale: 'tr', href: '/' })).toBe('/tr')
    expect(path({ locale: 'en', href: '/' })).toBe('/en')
  })

  it('translates static paths per locale', () => {
    expect(path({ locale: 'tr', href: '/galeri' })).toBe('/tr/galeri')
    expect(path({ locale: 'en', href: '/galeri' })).toBe('/en/gallery')
    expect(path({ locale: 'en', href: '/cerez-politikasi' })).toBe('/en/cookies')
  })

  it('fills dynamic params and appends the query', () => {
    expect(path({ locale: 'en', href: { pathname: '/projeler/[slug]', params: { slug: 'pool-deck' } } })).toBe('/en/projects/pool-deck')
    expect(path({ locale: 'tr', href: { pathname: '/[category]', params: { category: 'deck' }, query: { sayfa: '2' } } })).toBe('/tr/deck?sayfa=2')
    expect(path({ locale: 'en', href: { pathname: '/projeler', query: { kategori: 'deck' } } })).toBe('/en/projects?kategori=deck')
  })

  it('percent-encodes non-ASCII params', () => {
    expect(path({ locale: 'tr', href: { pathname: '/galeri/[slug]', params: { slug: 'çam' } } })).toBe('/tr/galeri/%C3%A7am')
  })

  it('throws when a param is missing', () => {
    expect(() => path({ locale: 'tr', href: { pathname: '/rehber/[slug]', params: {} } })).toThrow()
  })

  // Oracle: next-intl's own getPathname (whose Link we no longer ship to the client, #52) for every route.
  it('matches next-intl for every route and locale', () => {
    const { getPathname } = createNavigation(routing)
    for (const locale of routing.locales) {
      for (const pathname of Object.keys(routing.pathnames) as (keyof typeof routing.pathnames)[]) {
        const params = { slug: 'iroko-ş', category: 'teras-deck' }
        const href = { pathname, params, query: { a: 'b c' } } as Parameters<typeof getPathname>[0]['href']
        expect(path({ locale, href: href as Parameters<typeof localizedPathname>[1]['href'] })).toBe(getPathname({ locale, href }))
      }
    }
  })
})
