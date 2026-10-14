import { describe, expect, it } from 'vitest'

import { sitemapEntries } from './sitemap'

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
})
