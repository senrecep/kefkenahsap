import { describe, expect, it } from 'vitest'

import { formatM3, formatMoney, formatStamp, ISTANBUL } from './format'

// Intl separates currency and number with a no-break space in some locales; compare with plain spaces.
const plain = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ').replace(/[\u200e\u200f\u061c]/g, '')

describe('formatM3: three decimals, never a misleading 0 (bug D)', () => {
  it.each([
    ['tr', 0.2, '0,200'],
    ['tr', 0.016362, '0,016'],
    ['tr', 1234.5, '1.234,500'],
    ['en', 0.016362, '0.016'],
    ['de', 0.0005, '0,001'],
    ['tr', 0, '0,000'],
    ['tr', 0.0004, '<0,001'], // case D: 2×5×40 cm
    ['en', 0.0004, '<0.001'],
    ['ar', 0.0004, '<0.001'], // Latin digits on the Arabic page too (site rule), so SSR and browser agree
  ])('%s %d → %s', (locale, m3, expected) => {
    expect(plain(formatM3(m3, locale))).toBe(expected)
  })
})

describe('formatMoney: kuruş shown, Turkish lira in every locale', () => {
  it.each([
    ['tr', 400_000, '₺4.000,00'],
    ['tr', 20_199, '₺201,99'],
    ['en', 20_199, '₺201.99'],
    ['de', 12_300, '123,00 ₺'],
    ['ar', 12_300, '123.00 ₺'],
  ])('%s %i → %s', (locale, kurus, expected) => {
    expect(plain(formatMoney(kurus, locale))).toBe(expected)
  })
})

describe('formatStamp: Europe/Istanbul whatever the device time zone', () => {
  it('formats 2026-10-19T11:33Z as 14:33 in Istanbul', () => {
    expect(ISTANBUL).toBe('Europe/Istanbul')
    expect(plain(formatStamp(new Date('2026-10-19T11:33:00Z'), 'tr'))).toBe('19 Ekim 2026 14:33')
  })
})
