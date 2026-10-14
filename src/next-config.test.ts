import { describe, expect, it } from 'vitest'

import config from '../next.config'

type Rule = { source: string; headers: { key: string; value: string }[] }
const rules = async () => (await config.headers!()) as Rule[]
const has = (rule: Rule, key: string) => rule.headers.some((h) => h.key === key)

describe('next.config headers', () => {
  // #52: Payload's client hints on public pages made Chrome retry every first navigation.
  it('sends Critical-CH only under /admin', async () => {
    const withHint = (await rules()).filter((r) => has(r, 'Critical-CH'))
    expect(withHint.map((r) => r.source)).toEqual(['/admin/:path*'])
    expect((await rules()).filter((r) => r.source === '/:path*').some((r) => has(r, 'Critical-CH') || has(r, 'Accept-CH'))).toBe(false)
  })

  it('keeps noindex outside production and private lead photos', async () => {
    const all = await rules()
    expect(all.find((r) => r.source === '/:path*' && has(r, 'X-Robots-Tag'))?.headers).toContainEqual({ key: 'X-Robots-Tag', value: 'noindex, nofollow' })
    expect(all.find((r) => r.source === '/api/lead-photos/:path*')?.headers).toContainEqual({ key: 'Cache-Control', value: 'private, no-store' })
  })
})
