import { describe, expect, it } from 'vitest'

import { isMapEmbedUrl, isSafeHref } from './safe-href'

describe('isSafeHref', () => {
  it('allows site-relative paths and http(s) URLs', () => {
    for (const h of ['/referanslar', '/tr/deck-ve-zeminler', 'https://www.instagram.com/x', 'http://maps.app.goo.gl/x'])
      expect(isSafeHref(h)).toBe(true)
  })
  it('rejects script and protocol-relative URLs', () => {
    for (const h of ['javascript:alert(1)', ' JavaScript:alert(1)', 'data:text/html,x', '//evil.com', 'mailto:x@y'])
      expect(isSafeHref(h)).toBe(false)
  })
})

describe('isMapEmbedUrl', () => {
  it('allows only Google Maps embed URLs', () => {
    expect(isMapEmbedUrl('https://www.google.com/maps/embed?pb=!1m18!1m12')).toBe(true)
  })
  it('rejects other hosts, schemes and paths', () => {
    for (const h of ['http://www.google.com/maps/embed?pb=x', 'https://www.google.com.evil.com/maps/embed?pb=x', 'https://www.google.com/maps/place/x', 'javascript:alert(1)', '', null, undefined])
      expect(isMapEmbedUrl(h)).toBe(false)
  })
})
