import { describe, expect, it } from 'vitest'
import { Result } from 'tsentials/result'

import { decodeQuote, encodeQuote, isFilled, MAX_ROWS } from './codec'
import { emptyQuote, type QuoteInput } from './quote'

const full: QuoteInput = {
  units: ['mm', 'cm', 'm'],
  timber: [
    { t: '25', w: '10', l: '4', q: '10', p: '20.000' },
    { t: '2,5', w: '12', l: '3,5', q: '4', p: '' },
  ],
  waste: '7,5',
  extras: [
    { d: 'Paslanmaz vida (ğüşiöç İ)', q: '2,5', u: 'kg', p: '180' },
    { d: 'Nakliye', q: '', u: 'goturu', p: '1500' },
  ],
  vat: { on: false, rate: 10 },
  meta: { customer: 'Ahmet Bey', job: 'Veranda deck', note: 'Iroko, 2. kat\nkeşif sonrası' },
}
const code = (r: Result<unknown>) => (Result.isFailure(r) ? r.errors[0]?.code : 'ok')

describe('quote ↔ share-link codec (versioned, compact)', () => {
  it('round-trips every field, Turkish characters and line breaks included', () => {
    const encoded = encodeQuote(full)
    expect(encoded).toMatch(/^1\.[A-Za-z0-9_-]+$/) // URL-safe, version first
    expect(decodeQuote(encoded)).toEqual(Result.success(full))
  })

  it('round-trips the empty form', () => {
    expect(decodeQuote(encodeQuote(emptyQuote()))).toEqual(Result.success(emptyQuote()))
  })

  it('is short for a typical quote', () => {
    expect(encodeQuote(full).length).toBeLessThan(400)
  })

  it.each([
    ['', 'Calc.LinkInvalid'],
    ['2.e30', 'Calc.LinkVersion'],
    ['1.%%%', 'Calc.LinkInvalid'],
    ['1.a', 'Calc.LinkInvalid'], // not a whole base64 group
    [`1.${btoa('{"x":1}').replace(/=+$/, '')}`, 'Calc.LinkInvalid'], // valid JSON, wrong shape
    [`1.${'A'.repeat(20_000)}`, 'Calc.LinkTooLong'],
  ])('rejects %j', (input, expected) => {
    expect(code(decodeQuote(input))).toBe(expected)
  })

  it('rejects an unknown unit or VAT rate rather than guessing', () => {
    const bad = encodeQuote({ ...full, extras: [{ d: 'x', q: '1', u: 'ton' as never, p: '1' }] })
    expect(code(decodeQuote(bad))).toBe('Calc.LinkInvalid')
    expect(code(decodeQuote(encodeQuote({ ...full, vat: { on: true, rate: 18 as never } })))).toBe('Calc.LinkInvalid')
  })

  it(`keeps at most ${MAX_ROWS} rows per section and caps text lengths`, () => {
    const many = { ...full, timber: Array.from({ length: MAX_ROWS + 5 }, () => full.timber[0]!), meta: { ...full.meta, note: 'n'.repeat(2000) } }
    const r = decodeQuote(encodeQuote(many))
    expect(Result.isSuccess(r) && r.value.timber.length).toBe(MAX_ROWS)
    expect(Result.isSuccess(r) && r.value.meta.note.length).toBe(500)
  })

  it('isFilled: only a quote with something typed is a "filled" state', () => {
    expect(isFilled(emptyQuote())).toBe(false)
    expect(isFilled({ ...emptyQuote(), units: ['mm', 'cm', 'cm'] })).toBe(false)
    expect(isFilled(full)).toBe(true)
    expect(isFilled({ ...emptyQuote(), meta: { customer: 'A', job: '', note: '' } })).toBe(true)
  })
})
