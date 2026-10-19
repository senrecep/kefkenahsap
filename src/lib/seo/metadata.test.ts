import { existsSync } from 'node:fs'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { routing } from '@/i18n/routing'

import { buildMetadata, fullTitle, siteOgImage } from './metadata'

const SITE = 'https://www.kefkenahsap.com'
const ALT = 'Kefken Ahşap Dekorasyon: Ahşap deck, pergola'
const card = { url: '/og-tr.png', width: 1200, height: 630, alt: ALT }
const base = { siteName: 'Kefken Ahşap Dekorasyon', site: SITE, title: 'Deck ve Zeminler', description: 'Iroko ve teak deck.', ogImage: card }

describe('buildMetadata', () => {
  it('title, description, self-canonical, hreflang and matching OG/Twitter tags', () => {
    const m = buildMetadata({ ...base, locale: 'tr', paths: { tr: '/tr/deck-ve-zeminler', en: '/en/decking-and-flooring' } })
    expect(m.title).toBe('Deck ve Zeminler')
    expect(m.description).toBe('Iroko ve teak deck.')
    expect(m.alternates?.canonical).toBe(`${SITE}/tr/deck-ve-zeminler`)
    // Discover / rich results: full-size previews on every indexable page.
    expect(m.robots).toEqual({ index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 })
    expect(m.openGraph).toEqual({
      type: 'website',
      siteName: 'Kefken Ahşap Dekorasyon',
      title: 'Deck ve Zeminler',
      description: 'Iroko ve teak deck.',
      locale: 'tr_TR',
      alternateLocale: ['en_US'],
      url: `${SITE}/tr/deck-ve-zeminler`,
      images: [card],
    })
    expect(m.twitter).toEqual({ card: 'summary_large_image', title: 'Deck ve Zeminler', description: 'Iroko ve teak deck.', images: [card] })
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
    expect(m.twitter).not.toHaveProperty('images')
  })

  it('omits an empty description instead of emitting an empty tag', () => {
    const m = buildMetadata({ ...base, description: '  ', locale: 'tr', paths: { tr: '/tr/x' } })
    expect(m).not.toHaveProperty('description')
    expect(m.openGraph).not.toHaveProperty('description')
    expect(m.twitter).not.toHaveProperty('description')
  })
})

describe('siteOgImage (site-wide share card)', () => {
  it('without an admin image: the generated card of the page language, with size and alt', () => {
    expect(siteOgImage('tr', null, ALT)).toEqual({ url: '/og-tr.png', width: 1200, height: 630, alt: ALT })
    expect(siteOgImage('ar', undefined, 'alt ar')).toEqual({ url: '/og-ar.png', width: 1200, height: 630, alt: 'alt ar' })
  })

  it("the admin's default share image wins (served cropped by /og.jpg)", () => {
    expect(siteOgImage('en', { id: 4, url: '/media/x.webp' }, ALT)).toEqual({ url: '/og.jpg', width: 1200, height: 630, alt: ALT })
  })

  it('an unpopulated id (the public may not read it) is not an image: the generated card stays', () => {
    expect(siteOgImage('de', 4, ALT).url).toBe('/og-de.png')
  })
})

describe('title length (SERP shows ~60 chars)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('measures the rendered title: the layout template adds " | company" unless absolute', () => {
    expect(fullTitle('Galeri', 'Kefken Ahşap Dekorasyon')).toBe('Galeri | Kefken Ahşap Dekorasyon')
    expect(fullTitle({ absolute: 'Kefken Ahşap' }, 'Kefken Ahşap Dekorasyon')).toBe('Kefken Ahşap')
  })

  it('warns outside production when the rendered title is over 60 characters', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    buildMetadata({ ...base, title: 'Bahçede iroko deck, pergola ve korkuluk uygulaması', locale: 'tr', paths: { tr: '/tr/x' } })
    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0]![0]).toContain('76')
    warn.mockClear()
    buildMetadata({ ...base, locale: 'tr', paths: { tr: '/tr/x' } })
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('share cards', () => {
  it.each(routing.locales)('public/og-%s.png exists (rerun `bun run og:generate` after adding a locale)', (locale) => {
    expect(existsSync(path.join(process.cwd(), 'public', `og-${locale}.png`))).toBe(true)
  })
})
