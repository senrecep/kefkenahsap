import { afterEach, describe, expect, it, vi } from 'vitest'

import { legalUses } from '@/content/legal/kvkk'

import { gaIdOf, validateGaId } from './analytics'

describe('gaIdOf (#192: GA4 id from Site Bilgileri, env as fallback)', () => {
  it('uses the admin value when it is a GA4 id, trimmed', () => {
    expect(gaIdOf({ gaId: ' G-ABC123XYZ ' }, 'G-ENV0000')).toBe('G-ABC123XYZ')
  })

  it('falls back to the env value when the admin field is empty or not a GA4 id', () => {
    expect(gaIdOf({ gaId: null }, 'G-ENV0000')).toBe('G-ENV0000')
    expect(gaIdOf({ gaId: '' }, 'G-ENV0000')).toBe('G-ENV0000')
    expect(gaIdOf({ gaId: 'UA-1234-1' }, 'G-ENV0000')).toBe('G-ENV0000')
  })

  it('is undefined when neither is set (no GA, no banner)', () => {
    expect(gaIdOf({}, '')).toBeUndefined()
    expect(gaIdOf({ gaId: '  ' }, '')).toBeUndefined()
  })

  it('validates the admin field: empty or G-XXXX only', () => {
    expect(validateGaId(null)).toBe(true)
    expect(validateGaId('G-S84WKG63MS')).toBe(true)
    expect(validateGaId('UA-1234-1')).toMatch(/G-/)
    expect(validateGaId('G-ABC"><script>')).toMatch(/G-/)
  })
})

describe('legalUses names GA exactly when the site loads it (#156)', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('follows the admin GA id, then env', () => {
    vi.stubEnv('NEXT_PUBLIC_GA_ID', '')
    expect(legalUses({}).ga).toBe(false)
    expect(legalUses({ gaId: 'G-ABC123XYZ' }).ga).toBe(true)
    vi.stubEnv('NEXT_PUBLIC_GA_ID', 'G-ENV0000')
    expect(legalUses({}).ga).toBe(true)
  })
})
