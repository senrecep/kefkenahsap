import { describe, expect, it } from 'vitest'

import { isSafeHref } from './safe-href'

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
