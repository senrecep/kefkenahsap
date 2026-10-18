import { describe, expect, it } from 'vitest'

import { queryRoute } from './query-route'

// Expected paths come from routing.pathnames (src/i18n/routing.ts), written out by hand.
describe('queryRoute (#211)', () => {
  it('maps the gallery in every locale to the internal per-request copy', () => {
    expect(queryRoute('/tr/galeri')).toBe('/tr/_q/galeri')
    expect(queryRoute('/en/gallery')).toBe('/en/_q/galeri')
    expect(queryRoute('/de/galerie')).toBe('/de/_q/galeri')
    expect(queryRoute('/ru/galereya')).toBe('/ru/_q/galeri')
  })
  it('maps the project list', () => {
    expect(queryRoute('/tr/projeler')).toBe('/tr/_q/projeler')
    expect(queryRoute('/en/projects')).toBe('/en/_q/projeler')
  })
  it('maps a category (any single segment that is no fixed route)', () => {
    expect(queryRoute('/tr/deck-ve-zeminler')).toBe('/tr/_q/deck-ve-zeminler')
    expect(queryRoute('/en/decking')).toBe('/en/_q/decking')
  })
  it('leaves fixed routes, deeper paths and the home page alone', () => {
    for (const p of ['/tr', '/tr/iletisim', '/en/contact', '/tr/ara', '/en/search', '/tr/hizmetlerimiz', '/tr/galeri/feed', '/tr/galeri/bir-foto', '/tr/projeler/bir-proje', '/tr/rehber']) {
      expect(queryRoute(p), p).toBeNull()
    }
  })
  it('does not treat another locale’s fixed segment as a category', () => {
    // "gallery" is en's gallery; under /tr it is no route of its own, but it is reserved for categories too (src/lib/slug.ts).
    expect(queryRoute('/tr/gallery')).toBeNull()
  })
})
