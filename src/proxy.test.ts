import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import proxy from './proxy'

// Integration: the real proxy with a Host header, as Traefik forwards the apex.
const req = (path: string, host: string, init: { method?: string; headers?: Record<string, string> } = {}) =>
  new NextRequest(`http://${host}${path}`, { method: init.method, headers: { host, ...init.headers } })
const CANON = 'https://www.kefkenahsap.com'

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

  it('keeps the legacy Cache-Control and answers a day-cacheable 301', () => {
    expect(proxy(req('/deck-ve-zeminler/', 'kefkenahsap.com')).headers.get('cache-control')).toBe('public, max-age=86400')
  })

  it('handles the apex with a trailing dot', () => {
    expect(proxy(req('/deck-ve-zeminler/', 'kefkenahsap.com.')).headers.get('location')).toBe(`${CANON}/tr/deck-ve-zeminler`)
  })

  it('uses 308 for non-GET/HEAD so the method survives', () => {
    expect(proxy(req('/tr/iletisim', 'kefkenahsap.com', { method: 'POST' })).status).toBe(308)
    expect(proxy(req('/tr/iletisim', 'kefkenahsap.com', { method: 'HEAD' })).status).toBe(301)
  })

  it('ignores X-Forwarded-Host: only the Host header decides', () => {
    const res = proxy(req('/deck-ve-zeminler/', 'www.kefkenahsap.com', { headers: { 'x-forwarded-host': 'kefkenahsap.com' } }))
    expect(res.headers.get('location')).toBe('http://www.kefkenahsap.com/tr/deck-ve-zeminler') // relative to the request, not forced to https canonical
  })

  it('apex / goes to www /, and /?s= goes to the search page on www', () => {
    expect(proxy(req('/', 'kefkenahsap.com')).headers.get('location')).toBe(`${CANON}/`)
    expect(proxy(req('/?s=deck', 'kefkenahsap.com')).headers.get('location')).toBe(`${CANON}/tr/ara?q=deck`)
  })
})

// A path that starts with two slashes or a backslash must never become another host.
describe.each([
  ['//evil.com/x', 'kefkenahsap.com'],
  ['/\\evil.com', 'kefkenahsap.com'],
  ['///evil.com', 'kefkenahsap.com'],
  ['//evil.com/x', 'www.kefkenahsap.com'],
  ['/\\evil.com', 'www.kefkenahsap.com'],
  ['///evil.com', 'www.kefkenahsap.com'],
])('no open redirect: %s on %s', (path, host) => {
  beforeEach(() => vi.stubEnv('NEXT_PUBLIC_SITE_URL', CANON))
  afterEach(() => vi.unstubAllEnvs())

  it('never leaves the site', () => {
    const res = proxy(req(path, host))
    const location = res.headers.get('location')
    if (location) expect(new URL(location, `http://${host}`).hostname).toMatch(/(^|\.)kefkenahsap\.com$|^localhost$/)
    if (host === 'kefkenahsap.com') expect(location!.startsWith(`${CANON}/`)).toBe(true)
  })
})
