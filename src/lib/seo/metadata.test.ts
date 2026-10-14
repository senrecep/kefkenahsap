import { describe, expect, it } from 'vitest'

import { buildMetadata } from './metadata'

const SITE = 'https://www.kefkenahsap.com'
const base = { siteName: 'Kefken Ahşap Dekorasyon', site: SITE, title: 'Deck ve Zeminler', description: 'Iroko ve teak deck.' }

describe('buildMetadata', () => {
  it('title, description, self-canonical, hreflang and matching OG/Twitter tags', () => {
    const m = buildMetadata({ ...base, locale: 'tr', paths: { tr: '/tr/deck-ve-zeminler', en: '/en/decking-and-flooring' } })
    expect(m.title).toBe('Deck ve Zeminler')
    expect(m.description).toBe('Iroko ve teak deck.')
    expect(m.alternates?.canonical).toBe(`${SITE}/tr/deck-ve-zeminler`)
    expect(m.robots).toBeUndefined()
    expect(m.openGraph).toEqual({
      type: 'website',
      siteName: 'Kefken Ahşap Dekorasyon',
      title: 'Deck ve Zeminler',
      description: 'Iroko ve teak deck.',
      locale: 'tr_TR',
      alternateLocale: ['en_US'],
      url: `${SITE}/tr/deck-ve-zeminler`,
      images: [{ url: '/og.jpg', width: 1200, height: 630 }],
    })
    expect(m.twitter).toEqual({ card: 'summary_large_image', title: 'Deck ve Zeminler', description: 'Iroko ve teak deck.' })
  })

  it('an absolute title (homepage) is used as-is for OG', () => {
    const m = buildMetadata({ ...base, title: { absolute: 'Kefken Ahşap' }, locale: 'tr', paths: { tr: '/tr' } })
    expect(m.title).toEqual({ absolute: 'Kefken Ahşap' })
    expect(m.openGraph?.title).toBe('Kefken Ahşap')
  })

  it('untranslated locale → noindex, no canonical, no og:url', () => {
    const m = buildMetadata({ ...base, locale: 'en', paths: { tr: '/tr/projeler/x', en: null } })
    expect(m.robots).toEqual({ index: false, follow: true })
    expect(m.alternates?.canonical).toBeUndefined()
    expect(m.openGraph).not.toHaveProperty('url')
  })

  it('a page-level noindex (search, paginated duplicates) keeps its canonical', () => {
    const m = buildMetadata({ ...base, locale: 'tr', paths: { tr: '/tr/galeri' }, noindex: true })
    expect(m.robots).toEqual({ index: false, follow: true })
    expect(m.alternates?.canonical).toBe(`${SITE}/tr/galeri`)
  })

  it('a page with its own opengraph-image file sets no config image (it would override the file)', () => {
    const m = buildMetadata({ ...base, locale: 'tr', paths: { tr: '/tr/galeri/x' }, ownOgImage: true })
    expect(m.openGraph).not.toHaveProperty('images')
  })

  it('omits an empty description instead of emitting an empty tag', () => {
    const m = buildMetadata({ ...base, description: '  ', locale: 'tr', paths: { tr: '/tr/x' } })
    expect(m).not.toHaveProperty('description')
    expect(m.openGraph).not.toHaveProperty('description')
    expect(m.twitter).not.toHaveProperty('description')
  })
})
