import { describe, expect, it } from 'vitest'

import { robotsFor } from './robots'

const SITE = 'https://www.kefkenahsap.com'

describe('robotsFor (PLAN §7 Teknik 6)', () => {
  it('production: one `*` group — admin, API and search disallowed, everything else (incl. AI bots) allowed', () => {
    expect(robotsFor({ production: true, site: SITE, searchPaths: ['/tr/ara', '/en/search'] })).toEqual({
      rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api', '/tr/ara', '/en/search'] }],
      sitemap: `${SITE}/sitemap.xml`,
    })
  })
  it('any other environment blocks every crawler and advertises no sitemap', () => {
    expect(robotsFor({ production: false, site: SITE, searchPaths: ['/tr/ara'] })).toEqual({ rules: [{ userAgent: '*', disallow: '/' }] })
  })
})
