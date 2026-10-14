import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import proxy from './proxy'

// Integration: the real proxy with a Host header, as Traefik forwards the apex.
const req = (path: string, host: string) => new NextRequest(`http://${host}${path}`, { headers: { host } })

describe('proxy on the apex host', () => {
  beforeEach(() => vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.kefkenahsap.com'))
  afterEach(() => vi.unstubAllEnvs())

  it('sends an old page straight to its new path on www (one hop)', () => {
    const res = proxy(req('/deck-ve-zeminler/?a=1', 'kefkenahsap.com'))
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('https://www.kefkenahsap.com/tr/deck-ve-zeminler?a=1')
  })

  it('sends an unmapped old upload straight to 410, no hop', () => {
    expect(proxy(req('/wp-content/uploads/2099/01/none.jpg', 'kefkenahsap.com')).status).toBe(410)
  })

  it('sends any other path to the same path on www', () => {
    const res = proxy(req('/tr/projeler?x=1', 'kefkenahsap.com'))
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('https://www.kefkenahsap.com/tr/projeler?x=1')
  })

  it('leaves the www host alone: legacy still redirects relative to the request', () => {
    const res = proxy(req('/deck-ve-zeminler/', 'www.kefkenahsap.com'))
    expect(res.headers.get('location')).toBe('http://www.kefkenahsap.com/tr/deck-ve-zeminler')
  })

  it('does not redirect the healthcheck', () => {
    expect(proxy(req('/api/health', 'kefkenahsap.com')).headers.get('location')).toBeNull()
  })
})
