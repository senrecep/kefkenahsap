import { describe, expect, it } from 'vitest'
import { Result } from 'tsentials/result'

import { decodeQuote, encodeQuote, isFilled, MAX_ROWS } from './codec'
import { computeQuote, emptyQuote, type QuoteInput } from './quote'

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
const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const code = (r: Result<unknown>) => (Result.isFailure(r) ? r.errors[0]?.code : 'ok')

describe('quote ↔ share-link codec (versioned, compact)', () => {
  it('round-trips every field, Turkish characters and line breaks included', () => {
    const encoded = encodeQuote(full, 'tr')
    expect(encoded).toMatch(/^2\.[A-Za-z0-9_-]+$/) // URL-safe, version first
    // Numbers come back canonical, written for the Turkish page: "20.000" → "20000", "2,5" stays (the value is equal).
    const back = { ...full, timber: [{ ...full.timber[0]!, p: '20000' }, full.timber[1]!] }
    expect(decodeQuote(encoded, 'tr')).toEqual(Result.success(back))
  })

  it('stores numbers canonically: a quote typed on /tr opens on /en and /ru with the same values (#236 review)', () => {
    const encoded = encodeQuote(full, 'tr')
    const en = decodeQuote(encoded, 'en')
    expect(Result.isSuccess(en) && en.value.timber.map((r) => [r.t, r.p])).toEqual([['25', '20000'], ['2.5', '']])
    const totals = (q: Result<QuoteInput>, l: string) => Result.isSuccess(q) && computeQuote(q.value, l).totals
    expect(totals(en, 'en')).toEqual(computeQuote(full, 'tr').totals)
    expect(totals(decodeQuote(encoded, 'ru'), 'ru')).toEqual(computeQuote(full, 'tr').totals)
  })

  it('round-trips the empty form', () => {
    expect(decodeQuote(encodeQuote(emptyQuote(), 'tr'), 'tr')).toEqual(Result.success(emptyQuote()))
  })

  it('is short for a typical quote', () => {
    expect(encodeQuote(full, 'tr').length).toBeLessThan(400)
  })

  it.each([
    ['', 'Calc.LinkInvalid'],
    ['3.e30', 'Calc.LinkVersion'],
    ['1.%%%', 'Calc.LinkInvalid'],
    ['1.a', 'Calc.LinkInvalid'], // not a whole base64 group
    [`1.${btoa('{"x":1}').replace(/=+$/, '')}`, 'Calc.LinkInvalid'], // valid JSON, wrong shape
    [`2.${'A'.repeat(100_000)}`, 'Calc.LinkTooLong'],
  ])('rejects %j', (input, expected) => {
    expect(code(decodeQuote(input, 'tr'))).toBe(expected)
  })

  it('rejects a VAT pair with extra entries', () => {
    const packed = [['cm', 'cm', 'cm'], [], '', [], [1, 20, 99], ['', '', '']]
    expect(code(decodeQuote(`2.${b64(JSON.stringify(packed))}`, 'tr'))).toBe('Calc.LinkInvalid')
  })

  it('round-trips the largest quote the form allows (50 + 50 rows, every field full, worst-case characters)', () => {
    const worst = (n: number) => '\u20ac'.repeat(n) // 3 UTF-8 bytes per character: the longest a field can encode to
    const huge: QuoteInput = {
      units: ['mm', 'cm', 'm'],
      timber: Array.from({ length: MAX_ROWS }, () => ({ t: worst(24), w: worst(24), l: worst(24), q: worst(24), p: worst(24) })),
      waste: worst(24),
      extras: Array.from({ length: MAX_ROWS }, () => ({ d: worst(80), q: worst(24), u: 'goturu' as const, p: worst(24) })),
      vat: { on: true, rate: 20 },
      meta: { customer: worst(80), job: worst(120), note: worst(500) },
    }
    expect(decodeQuote(encodeQuote(huge, 'tr'), 'tr')).toEqual(Result.success(huge))
  })

  it('reads an old v1 link with the Turkish rules it was written under (#236 review)', () => {
    // v1 = the same packing; "20.000" was 20 000 ₺, "20,500" 20,50 ₺ and a dimension "1.000" was 1 (decimal point).
    const v1 = [['cm', 'cm', 'cm'], [['5', '10', '400', '10', '20.000'], ['1.000', '100', '100', '1', '20,500']], '', [['Nakliye', '', 'goturu', '1.500']], [1, 20], ['', '', '']]
    const r = decodeQuote(`1.${b64(JSON.stringify(v1))}`, 'tr')
    expect(Result.isSuccess(r)).toBe(true)
    if (!Result.isSuccess(r)) return
    expect(r.value.timber.map((x) => [x.t, x.p])).toEqual([['5', '20000'], ['1,000', '20,5']]) // tr form of 1.000 and 20.5
    // 0,2 m³ × 20 000 = 4 000,00; 0,01 m³ × 20,50 = 0,205 → 0,21; + 1 500,00 = 5 500,21; KDV 1 100,04 (110 004,2 kr); 6 600,25
    const t = computeQuote(r.value, 'tr').totals
    expect([t.subtotalKurus, t.vatKurus, t.grandKurus]).toEqual([550_021, 110_004, 660_025])
  })

  it('rejects an unknown unit or VAT rate rather than guessing', () => {
    const bad = encodeQuote({ ...full, extras: [{ d: 'x', q: '1', u: 'ton' as never, p: '1' }] }, 'tr')
    expect(code(decodeQuote(bad, 'tr'))).toBe('Calc.LinkInvalid')
    expect(code(decodeQuote(encodeQuote({ ...full, vat: { on: true, rate: 18 as never } }, 'tr'), 'tr'))).toBe('Calc.LinkInvalid')
  })

  it(`keeps at most ${MAX_ROWS} rows per section and caps text lengths`, () => {
    const many = { ...full, timber: Array.from({ length: MAX_ROWS + 5 }, () => full.timber[0]!), meta: { ...full.meta, note: 'n'.repeat(2000) } }
    const r = decodeQuote(encodeQuote(many, 'tr'), 'tr')
    expect(Result.isSuccess(r) && r.value.timber.length).toBe(MAX_ROWS)
    expect(Result.isSuccess(r) && r.value.meta.note.length).toBe(500)
  })

  it('isFilled: only a quote with something typed is a "filled" state', () => {
    expect(isFilled(emptyQuote())).toBe(false)
    expect(isFilled({ ...emptyQuote(), units: ['mm', 'cm', 'cm'] })).toBe(false)
    expect(isFilled(full)).toBe(true)
    expect(isFilled({ ...emptyQuote(), meta: { customer: 'A', job: '', note: '' } })).toBe(true)
    // UI rows carry a numeric key next to the typed fields
    expect(isFilled({ ...emptyQuote(), timber: [{ ...emptyQuote().timber[0]!, id: 1 } as never] })).toBe(false)
  })
})
