import { describe, expect, it } from 'vitest'

import { apexRedirectOrigin } from './host'

const www = 'https://www.kefkenahsap.com'

describe('apexRedirectOrigin', () => {
  it('returns the canonical origin for the apex of a www canonical host', () => {
    expect(apexRedirectOrigin('kefkenahsap.com', www)).toBe(www)
  })
  it('ignores port and case, and a trailing path on the site URL', () => {
    expect(apexRedirectOrigin('KefkenAhsap.com:443', `${www}/`)).toBe(www)
  })
  it('ignores a trailing dot (absolute FQDN)', () => {
    expect(apexRedirectOrigin('kefkenahsap.com.', www)).toBe(www)
    expect(apexRedirectOrigin('kefkenahsap.com.:443', www)).toBe(www)
  })
  it('does nothing on the canonical host itself', () => {
    expect(apexRedirectOrigin('www.kefkenahsap.com', www)).toBeNull()
  })
  it('does nothing for unrelated hosts (dev, IP, healthcheck) or a missing host', () => {
    expect(apexRedirectOrigin('development.kefkenahsap.com', www)).toBeNull()
    expect(apexRedirectOrigin('127.0.0.1:3000', www)).toBeNull()
    expect(apexRedirectOrigin(null, www)).toBeNull()
  })
  it('does nothing when the canonical host is not www or the site URL is unset', () => {
    expect(apexRedirectOrigin('kefkenahsap.com', 'https://kefkenahsap.com')).toBeNull()
    expect(apexRedirectOrigin('localhost:3000', 'http://localhost:3000')).toBeNull()
    expect(apexRedirectOrigin('kefkenahsap.com', undefined)).toBeNull()
  })
})
