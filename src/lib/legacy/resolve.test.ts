import { describe, expect, it } from 'vitest'

import { resolveLegacy, type LegacyMaps } from './resolve'

const maps: LegacyMaps = {
  media: { '2018/09/1-1': { file: 'havuz-kenari-iroko-deck.webp', category: 'deck-ve-zeminler' }, '2021/02/kapidolap2': { file: 'surgulu-kapi.webp', category: 'kapi-dolap-ve-seperator' } },
  attachments: { '/korkuluk-ve-cit/whatsapp-image-2021-06-08/': { file: 'bahce-korkulugu.webp', category: 'korkuluk-ve-cit' } },
  attachmentPaths: new Set(['/korkuluk-ve-cit/whatsapp-image-2021-06-08/', '/korkuluk-ve-cit/whatsapp-image-1999-01-01/', '/33-2/', '/deck-ve-zeminler/attachment/13/']),
}
const CDN = 'https://cdn.kefkenahsap.com'
const r = (p: string, q = '') => resolveLegacy(p, q, maps, CDN)

describe('resolveLegacy — media files', () => {
  it('sends any WP size variant of a matched image to the CDN original (301)', () => {
    for (const p of ['/wp-content/uploads/2018/09/1-1.jpg', '/wp-content/uploads/2018/09/1-1-400x400.jpg', '/wp-content/uploads/2018/09/1-1-1024x768.jpg'])
      expect(r(p)).toEqual({ kind: 'redirect', status: 301, location: `${CDN}/havuz-kenari-iroko-deck.webp` })
  })
  it('matches percent-encoded Turkish file names', () => {
    expect(r('/wp-content/uploads/2021/02/kap%C4%B1dolap2-300x200.jpeg')).toEqual({ kind: 'redirect', status: 301, location: `${CDN}/surgulu-kapi.webp` })
  })
  it('answers 410 for theme/plugin uploads outside YYYY/MM', () => {
    expect(r('/wp-content/uploads/revslider/business-1/apple-x-80x80.jpg')).toEqual({ kind: 'gone' })
  })

  it('answers 410 for uploads that were not carried over', () => {
    expect(r('/wp-content/uploads/2018/09/unknown-400x400.jpg')).toEqual({ kind: 'gone' })
    expect(r('/wp-content/uploads/2026/01/brief.mp3')).toEqual({ kind: 'gone' })
  })
})

describe('resolveLegacy — pages', () => {
  it('maps old category and info pages to their /tr page (with or without trailing slash)', () => {
    expect(r('/deck-ve-zeminler/')).toEqual({ kind: 'redirect', status: 301, location: '/tr/deck-ve-zeminler' })
    expect(r('/ireko-teak')).toEqual({ kind: 'redirect', status: 301, location: '/tr/ireko-teak' })
    expect(r('/hakkimizda/')).toEqual({ kind: 'redirect', status: 301, location: '/tr/hakkimizda' })
    expect(r('/kefken-ahsap-dekorasyon/')).toEqual({ kind: 'redirect', status: 301, location: '/tr' })
  })
  it('matches old page slugs case-insensitively, like WordPress did', () => {
    expect(r('/Deck-ve-Zeminler/')).toEqual({ kind: 'redirect', status: 301, location: '/tr/deck-ve-zeminler' })
    expect(r('/FEED/')).toEqual({ kind: 'redirect', status: 301, location: '/tr' })
  })
  it('survives a malformed percent-escape', () => {
    expect(r('/wp-content/uploads/2018/09/%E0%A4%A.jpg')).toEqual({ kind: 'gone' })
  })
  it('keeps the query string on page redirects', () => {
    expect(r('/iletisim/', '?utm_source=gbp')).toEqual({ kind: 'redirect', status: 301, location: '/tr/iletisim?utm_source=gbp' })
  })
  it('answers 410 for unmapped one- and three-segment attachment pages', () => {
    expect(r('/33-2/')).toEqual({ kind: 'gone' })
    expect(r('/deck-ve-zeminler/attachment/13/')).toEqual({ kind: 'gone' })
  })

  it('sends matched attachment pages to the image page and unmatched ones to 410', () => {
    expect(r('/korkuluk-ve-cit/whatsapp-image-2021-06-08/')).toEqual({ kind: 'redirect', status: 301, location: '/tr/galeri/bahce-korkulugu' })
    expect(r('/korkuluk-ve-cit/whatsapp-image-1999-01-01/')).toEqual({ kind: 'gone' })
  })
})

describe('resolveLegacy — WordPress internals and new URLs', () => {
  it('retires WordPress endpoints with 410', () => {
    for (const p of ['/wp-admin/', '/wp-login.php', '/xmlrpc.php', '/wp-json/wp/v2/posts', '/category/genel/', '/author/admin/'])
      expect(r(p)).toEqual({ kind: 'gone' })
  })
  it('sends the feed and WP search to the new home and search pages', () => {
    expect(r('/feed/')).toEqual({ kind: 'redirect', status: 301, location: '/tr' })
    expect(r('/', '?s=deck')).toEqual({ kind: 'redirect', status: 301, location: '/tr/ara?q=deck' })
  })
  it('passes through new site URLs and unknown paths', () => {
    expect(r('/tr/deck-ve-zeminler')).toEqual({ kind: 'pass' })
    expect(r('/')).toEqual({ kind: 'pass' })
    expect(r('/some-new-thing')).toEqual({ kind: 'pass' })
  })
})
