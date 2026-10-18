import { describe, expect, it } from 'vitest'

import { queryRoute } from './query-route'

// Expected paths come from routing.pathnames (src/i18n/routing.ts), written out by hand.
const q = (s: string) => new URLSearchParams(s)

describe('queryRoute (#211)', () => {
  it('maps the gallery in every locale to the internal per-request copy', () => {
    expect(queryRoute('/tr/galeri', q('kategori=deck'))).toBe('/tr/_q/galeri')
    expect(queryRoute('/en/gallery', q('etiket=x'))).toBe('/en/_q/galeri')
    expect(queryRoute('/de/galerie', q('sayfa=2'))).toBe('/de/_q/galeri')
    expect(queryRoute('/ru/galereya', q('sayfa=2&utm_source=x'))).toBe('/ru/_q/galeri')
  })
  it('maps the project list by its category filter', () => {
    expect(queryRoute('/tr/projeler', q('kategori=deck'))).toBe('/tr/_q/projeler')
    expect(queryRoute('/en/projects', q('kategori=deck'))).toBe('/en/_q/projeler')
  })
  it('maps a category (any single segment that is no fixed route) by its page number', () => {
    expect(queryRoute('/tr/deck-ve-zeminler', q('sayfa=2'))).toBe('/tr/_q/deck-ve-zeminler')
    expect(queryRoute('/en/decking', q('sayfa=3'))).toBe('/en/_q/decking')
  })
  it('keeps queries a page does not read on the cached page', () => {
    for (const [p, s] of [
      ['/tr/galeri', 'utm_source=x&gclid=1'],
      ['/tr/projeler', 'sayfa=2'],
      ['/tr/projeler', 'fbclid=1'],
      ['/tr/deck-ve-zeminler', 'kategori=x'],
      ['/tr/deck-ve-zeminler', 'preview=1'],
      ['/tr/galeri', ''],
    ] as const) {
      expect(queryRoute(p, q(s)), `${p}?${s}`).toBeNull()
    }
  })
  it('leaves fixed routes, deeper paths and the home page alone', () => {
    for (const p of ['/tr', '/tr/iletisim', '/en/contact', '/tr/ara', '/en/search', '/tr/hizmetlerimiz', '/tr/galeri/feed', '/tr/galeri/bir-foto', '/tr/projeler/bir-proje', '/tr/rehber']) {
      expect(queryRoute(p, q('sayfa=2&kategori=x')), p).toBeNull()
    }
  })
  it('does not treat another locale’s fixed segment as a category', () => {
    // "gallery" is en's gallery; under /tr it is no route of its own, but it is reserved for categories too (src/lib/slug.ts).
    expect(queryRoute('/tr/gallery', q('sayfa=2'))).toBeNull()
  })
})
