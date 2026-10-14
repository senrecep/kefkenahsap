import { describe, expect, it } from 'vitest'
import { Maybe } from 'tsentials/maybe'

import { galleryLimit, hasRichText, pageFromQuery, priceGuide } from './category'

describe('pageFromQuery (?sayfa=)', () => {
  it('accepts positive integers', () => {
    expect(pageFromQuery('3')).toBe(3)
  })
  it('falls back to 1 for missing, non-numeric, zero, negative or fractional values', () => {
    for (const v of [undefined, '', 'abc', '0', '-2', '1.5', ['2', '3']]) expect(pageFromQuery(v)).toBe(1)
  })
  it('caps very large pages', () => {
    expect(pageFromQuery('9999')).toBe(20)
  })
  it('shows pages cumulatively, 24 per page', () => {
    expect(galleryLimit(1)).toBe(24)
    expect(galleryLimit(3)).toBe(72)
  })
})

describe('priceGuide', () => {
  it('is none when neither min nor max is set', () => {
    expect(Maybe.isNone(priceGuide({}, 'tr'))).toBe(true)
    expect(Maybe.isNone(priceGuide({ min: null, max: null, unit: 'm2', currency: 'TRY' }, 'tr'))).toBe(true)
  })
  it('formats a range with unit, currency and update date', () => {
    const p = priceGuide({ min: 2500, max: 4000, unit: 'm2', currency: 'TRY', note: 'Ahşap türüne göre', updatedAt: '2026-09-01T00:00:00.000Z' }, 'tr')
    expect(Maybe.isSome(p)).toBe(true)
    if (!Maybe.isSome(p)) return
    // Intl uses narrow no-break spaces in tr currency output; compare on normalized spaces.
    expect(p.value.range.replace(/\s/g, ' ')).toBe('₺2.500 – ₺4.000')
    expect(p.value.unit).toBe('m2')
    expect(p.value.note).toBe('Ahşap türüne göre')
    expect(p.value.updatedAt).toBe('2026-09-01T00:00:00.000Z')
  })
  it('drops a unit outside m2 / m / piece', () => {
    const p = priceGuide({ min: 100, unit: 'ton' }, 'tr')
    expect(Maybe.isSome(p) && p.value.unit).toBeUndefined()
  })
  it('is none when the currency cannot be formatted', () => {
    expect(Maybe.isNone(priceGuide({ min: 100, currency: 'not-a-currency' }, 'tr'))).toBe(true)
  })
  it('shows a single bound when only one is set', () => {
    const p = priceGuide({ min: 100, currency: 'EUR' }, 'en')
    expect(Maybe.isSome(p) && p.value.range).toBe('€100')
  })
})

describe('hasRichText', () => {
  const para = (text: string) => ({ type: 'paragraph', children: text ? [{ type: 'text', text }] : [] })
  it('is false for null and for the empty editor state (one empty paragraph)', () => {
    expect(hasRichText(null)).toBe(false)
    expect(hasRichText({ root: { children: [para('')] } })).toBe(false)
    expect(hasRichText({ root: { children: [para('   ')] } })).toBe(false)
  })
  it('is true when any node carries text', () => {
    expect(hasRichText({ root: { children: [para(''), para('Deck')] } })).toBe(true)
  })
  it('is true for non-text content such as an upload', () => {
    expect(hasRichText({ root: { children: [{ type: 'upload', value: 1 }] } })).toBe(true)
  })
})
