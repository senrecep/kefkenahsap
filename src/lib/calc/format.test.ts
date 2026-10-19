import { describe, expect, it } from 'vitest'

import { echoValue, formatM3, formatMoney, formatStamp, ISTANBUL } from './format'

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

describe('echoValue: the value as read, shown under a field so a misread is visible at once (owner decision)', () => {
  it.each([
    ['tr', '20.000', 'money', '₺20.000,00'],
    ['tr', '20000', 'money', '₺20.000,00'],
    ['en', '20,000', 'money', '₺20,000.00'],
    ['tr', '2.5', 'number', '2,5'], // phone keypad dot read as the decimal point
    ['tr', '1.000', 'number', '1000'], // a thousand: shown without grouping, so it cannot read as 1
    ['en', '2,5', 'number', '2.5'],
  ] as const)('%s %j (%s) → %s', (locale, raw, kind, expected) => {
    expect(echoValue(raw, kind, locale)?.replace(/[  ]/g, ' ')).toBe(expected)
  })
  it('nothing for an empty or unreadable field, or one that already reads exactly as typed', () => {
    expect(echoValue('', 'number', 'tr')).toBeNull()
    expect(echoValue('abc', 'number', 'tr')).toBeNull()
    expect(echoValue('400', 'number', 'tr')).toBeNull()
    expect(echoValue('1,000', 'count', 'tr')).toBeNull() // an ambiguous count is not echoed as 1
    expect(echoValue('0,505', 'money', 'tr')).toBeNull() // the price field rejects three decimals: no echo of ₺0,51 (#236 re-review)
    expect(echoValue('2,5', 'number', 'tr')).toBeNull()
  })
})
