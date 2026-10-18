import { describe, expect, it } from 'vitest'

import { robotsFor } from './robots'

const SITE = 'https://www.kefkenahsap.com'

describe('robotsFor (PLAN §7 Teknik 6)', () => {
  it('production: one `*` group — admin, API and search disallowed, everything else (incl. AI bots) allowed', () => {
    expect(robotsFor({ siteEnv: 'production', site: SITE, searchPaths: ['/tr/ara', '/en/search'] })).toEqual({
      rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api', '/tr/ara', '/en/search'] }],
      sitemap: `${SITE}/sitemap.xml`,
    })
  })
  it('any other environment blocks every crawler and advertises no sitemap', () => {
    expect(robotsFor({ siteEnv: 'development', site: SITE, searchPaths: ['/tr/ara'] })).toEqual({ rules: [{ userAgent: '*', disallow: '/' }] })
  })
  it('only the exact value SITE_ENV=production counts as production', () => {
    for (const siteEnv of [undefined, '', 'Production', 'production ', 'prod', 'staging']) {
      expect(robotsFor({ siteEnv, site: SITE, searchPaths: [] }).rules, String(siteEnv)).toEqual([{ userAgent: '*', disallow: '/' }])
    }
  })
})
