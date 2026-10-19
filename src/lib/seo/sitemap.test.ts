import { describe, expect, it } from 'vitest'

import { cmsRoutePaths } from '@/lib/i18n/published'

import { parseSitemapFile, sitemapEntries, sitemapFile, sitemapIndexXml, urlsetXml } from './sitemap'

const SITE = 'https://www.kefkenahsap.com'

describe('sitemapEntries (PLAN §7 Teknik 8)', () => {
  it('one <url> per live locale, each listing every live locale + x-default, lastmod from updatedAt', () => {
    const entries = sitemapEntries([{ paths: { tr: '/tr/deck-ve-zeminler', en: '/en/decking-and-flooring' }, lastModified: '2026-10-01T10:00:00.000Z' }], SITE)
    const languages = {
      tr: `${SITE}/tr/deck-ve-zeminler`,
      en: `${SITE}/en/decking-and-flooring`,
      'x-default': `${SITE}/tr/deck-ve-zeminler`,
    }
    expect(entries).toEqual([
      { url: `${SITE}/tr/deck-ve-zeminler`, lastModified: '2026-10-01T10:00:00.000Z', alternates: { languages } },
      { url: `${SITE}/en/decking-and-flooring`, lastModified: '2026-10-01T10:00:00.000Z', alternates: { languages } },
    ])
  })

  it('untranslated locales (noindex) are left out entirely; no lastmod when unknown', () => {
    expect(sitemapEntries([{ paths: { tr: '/tr/projeler/x', en: null } }], SITE)).toEqual([
      { url: `${SITE}/tr/projeler/x`, alternates: { languages: { tr: `${SITE}/tr/projeler/x`, 'x-default': `${SITE}/tr/projeler/x` } } },
    ])
  })

  it('image URLs ride on their page entry (image sitemap extension)', () => {
    const [e] = sitemapEntries([{ paths: { tr: '/tr/galeri/a' }, images: ['https://cdn.kefkenahsap.com/a.webp'] }], SITE)
    expect(e?.images).toEqual(['https://cdn.kefkenahsap.com/a.webp'])
  })

  it('a CMS-backed fixed route (about) with a Turkish title only lists Turkish — the English page is noindex', () => {
    const paths = cmsRoutePaths({ tr: '/tr/hakkimizda', en: '/en/about' }, { tr: 'Hakkımızda', en: null })
    expect(sitemapEntries([{ paths }], SITE)).toEqual([
      { url: `${SITE}/tr/hakkimizda`, alternates: { languages: { tr: `${SITE}/tr/hakkimizda`, 'x-default': `${SITE}/tr/hakkimizda` } } },
    ])
  })
})

describe('split sitemaps: one child per locale and kind, under an index', () => {
  const docs = [{ paths: { tr: '/tr/deck-ve-zeminler', en: '/en/decking-and-flooring' } }, { paths: { tr: '/tr/projeler/x', en: null } }]

  it('a locale filter keeps only that locale\'s URLs, each still listing every live alternate', () => {
    const en = sitemapEntries(docs, SITE, 'en')
    expect(en.map((e) => e.url)).toEqual([`${SITE}/en/decking-and-flooring`])
    expect(en[0]!.alternates?.languages).toEqual({ tr: `${SITE}/tr/deck-ve-zeminler`, en: `${SITE}/en/decking-and-flooring`, 'x-default': `${SITE}/tr/deck-ve-zeminler` })
    expect(sitemapEntries(docs, SITE, 'tr').map((e) => e.url)).toEqual([`${SITE}/tr/deck-ve-zeminler`, `${SITE}/tr/projeler/x`])
    expect(sitemapEntries(docs, SITE, 'ru')).toEqual([])
  })

  it('child file names round-trip; anything else is unknown', () => {
    expect(sitemapFile('tr', 'photos')).toBe('tr-photos.xml')
    expect(parseSitemapFile('en-pages.xml')).toEqual({ locale: 'en', kind: 'pages' })
    for (const bad of ['xx-pages.xml', 'tr-videos.xml', 'tr-pages', 'tr-pages.xml.gz', '../tr-pages.xml']) expect(parseSitemapFile(bad), bad).toBeNull()
  })

  it('urlset XML: loc, hreflang alternates, image and lastmod, with XML escaping', () => {
    const xml = urlsetXml([
      {
        url: `${SITE}/tr/galeri/a&b`,
        lastModified: '2026-10-01T10:00:00.000Z',
        alternates: { languages: { tr: `${SITE}/tr/galeri/a&b`, 'x-default': `${SITE}/tr/galeri/a&b` } },
        images: ['https://cdn.kefkenahsap.com/a.webp'],
      },
      { url: `${SITE}/tr`, alternates: { languages: { tr: `${SITE}/tr` } } },
    ])
    expect(xml).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
        `<url>\n<loc>${SITE}/tr/galeri/a&amp;b</loc>\n` +
        `<xhtml:link rel="alternate" hreflang="tr" href="${SITE}/tr/galeri/a&amp;b" />\n` +
        `<xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/tr/galeri/a&amp;b" />\n` +
        '<image:image>\n<image:loc>https://cdn.kefkenahsap.com/a.webp</image:loc>\n</image:image>\n' +
        '<lastmod>2026-10-01T10:00:00.000Z</lastmod>\n</url>\n' +
        `<url>\n<loc>${SITE}/tr</loc>\n<xhtml:link rel="alternate" hreflang="tr" href="${SITE}/tr" />\n</url>\n` +
        '</urlset>\n',
    )
  })

  it('index XML lists each child sitemap', () => {
    expect(sitemapIndexXml([`${SITE}/sitemaps/tr-pages.xml`, `${SITE}/sitemaps/tr-photos.xml`])).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        `<sitemap>\n<loc>${SITE}/sitemaps/tr-pages.xml</loc>\n</sitemap>\n<sitemap>\n<loc>${SITE}/sitemaps/tr-photos.xml</loc>\n</sitemap>\n` +
        '</sitemapindex>\n',
    )
  })
})
