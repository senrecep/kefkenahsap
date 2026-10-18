import { describe, expect, it } from 'vitest'

import { cmsRoutePaths, fixedRoutePaths, livePaths, localeSeo, ogLocale, publishedLocales } from './published'

const SITE = 'https://www.kefkenahsap.com'

describe('publishedLocales (PLAN §5.1: slug + title filled → the locale is live)', () => {
  it('keeps only locales with both a slug and a title', () => {
    expect(
      publishedLocales({
        tr: { slug: 'deck-ve-zeminler', title: 'Deck ve Zeminler' },
        en: { slug: 'decking', title: '' },
        ar: { slug: null, title: 'x' },
      }),
    ).toEqual(['tr'])
  })
  it('treats whitespace-only values as empty', () => {
    expect(publishedLocales({ tr: { slug: 'a', title: 'A' }, en: { slug: ' ', title: 'B' } })).toEqual(['tr'])
  })
})

describe('livePaths', () => {
  it('a path for each live locale, null for the rest (feeds hreflang, sitemap and noindex alike)', () => {
    const paths = livePaths(
      { tr: { slug: 'kosk', title: 'Köşk' }, en: { slug: 'mansion', title: null } },
      (l, slug) => `/${l}/p/${slug}`,
    )
    expect(paths).toEqual({ tr: '/tr/p/kosk', en: null })
  })
})

describe('cmsRoutePaths (about, legal)', () => {
  const paths = { tr: '/tr/hakkimizda', en: '/en/about' }
  it('no CMS page: the in-repo template exists in every locale', () => {
    expect(cmsRoutePaths(paths, null)).toEqual(paths)
  })
  it('a CMS page without an English title: English is not live', () => {
    expect(cmsRoutePaths(paths, { tr: 'Hakkımızda', en: null })).toEqual({ tr: '/tr/hakkimizda', en: null })
  })
})

describe('localeSeo', () => {
  const paths = { tr: '/tr/projeler/kosk', en: '/en/projects/mansion' }

  it('a published locale: indexable, self-canonical, hreflang for live locales + x-default', () => {
    const s = localeSeo({ current: 'en', paths, site: SITE })
    expect(s.robots).toBeUndefined()
    expect(s.alternates).toEqual({
      canonical: `${SITE}/en/projects/mansion`,
      languages: { tr: `${SITE}/tr/projeler/kosk`, en: `${SITE}/en/projects/mansion`, 'x-default': `${SITE}/tr/projeler/kosk` },
    })
    expect(s.openGraph).toEqual({ locale: 'en_US', alternateLocale: ['tr_TR'], url: `${SITE}/en/projects/mansion` })
  })

  it('an untranslated locale: noindex only — no cross-locale canonical, absent from hreflang', () => {
    const s = localeSeo({ current: 'en', paths: { tr: paths.tr, en: null }, site: SITE })
    expect(s.robots).toEqual({ index: false, follow: true })
    expect(s.alternates.canonical).toBeUndefined()
    expect(s.alternates.languages).toEqual({ tr: `${SITE}/tr/projeler/kosk`, 'x-default': `${SITE}/tr/projeler/kosk` })
    expect(s.openGraph).toEqual({ locale: 'en_US', alternateLocale: ['tr_TR'] })
  })

  it('other untranslated locales are left out of og:locale:alternate', () => {
    expect(localeSeo({ current: 'tr', paths: { tr: paths.tr, en: undefined }, site: SITE }).openGraph.alternateLocale).toEqual([])
  })
})

describe('ogLocale', () => {
  it('maps to Open Graph language_TERRITORY', () => {
    expect(ogLocale('tr')).toBe('tr_TR')
    expect(ogLocale('en')).toBe('en_US')
    expect(ogLocale('ru')).toBe('ru_RU')
    expect(ogLocale('de')).toBe('de_DE')
    expect(ogLocale('ar')).toBe('ar_AR') // Facebook's supported-locale code for Arabic
  })
})

describe('fixedRoutePaths (a fixed route is live only in a locale that has its own content)', () => {
  const paths = { tr: '/tr/galeri', en: '/en/gallery', ru: '/ru/galereya', de: '/de/galerie' }
  it('null for locales without content, so they are noindex and left out of hreflang/sitemap', () => {
    expect(fixedRoutePaths(paths, ['tr', 'en'])).toEqual({ tr: '/tr/galeri', en: '/en/gallery', ru: null, de: null })
  })
  it('keeps an already-null path null', () => {
    expect(fixedRoutePaths({ tr: '/tr/kvkk', en: null }, ['tr', 'en'])).toEqual({ tr: '/tr/kvkk', en: null })
  })
})
