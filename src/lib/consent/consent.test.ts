import { describe, expect, it } from 'vitest'

import { CONSENT_COOKIE, consentCookie, gaCookieDeletions, readConsent } from './consent'

describe('readConsent', () => {
  it('reads the stored choice among other cookies', () => {
    expect(readConsent(`a=1; ${CONSENT_COOKIE}=granted; b=2`)).toBe('granted')
    expect(readConsent(`${CONSENT_COOKIE}=denied`)).toBe('denied')
  })

  it('returns null when no valid choice is stored', () => {
    expect(readConsent('')).toBeNull()
    expect(readConsent(`${CONSENT_COOKIE}=maybe`)).toBeNull()
    expect(readConsent(`x${CONSENT_COOKIE}=granted`)).toBeNull()
  })
})

describe('consentCookie', () => {
  it('keeps the choice for 6 months, site-wide, first-party only', () => {
    expect(consentCookie('granted', false)).toBe(`${CONSENT_COOKIE}=granted; Max-Age=15552000; Path=/; SameSite=Lax`)
    expect(consentCookie('denied', true)).toBe(`${CONSENT_COOKIE}=denied; Max-Age=15552000; Path=/; SameSite=Lax; Secure`)
  })
})

describe('gaCookieDeletions', () => {
  it('expires _ga and _ga_* on the host and on the apex domain GA uses', () => {
    expect(gaCookieDeletions('_ga=GA1.1.1; kh_consent=granted; _ga_ABC123=GS1.1; _gaz=1', 'www.kefkenahsap.com')).toEqual([
      '_ga=; Max-Age=0; Path=/',
      '_ga=; Max-Age=0; Path=/; Domain=kefkenahsap.com',
      '_ga_ABC123=; Max-Age=0; Path=/',
      '_ga_ABC123=; Max-Age=0; Path=/; Domain=kefkenahsap.com',
    ])
  })

  it('skips the Domain attribute on dotless hosts (localhost)', () => {
    expect(gaCookieDeletions('_ga=1', 'localhost')).toEqual(['_ga=; Max-Age=0; Path=/'])
  })
})
