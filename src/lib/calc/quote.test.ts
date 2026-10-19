import { describe, expect, it } from 'vitest'
import { Result } from 'tsentials/result'

import { computeQuote, emptyQuote, roundHalfUp, type ExtraInput, type QuoteInput, type TimberInput } from './quote'

// Every expected value below is computed by hand (docs/calculator/PLAN.md §2.2, the audit of the old app):
// V[m³] = t·w·L (in metres) × count; amount = V × price; KDV = round(subtotal × rate); money in kuruş, half-up.
const row = (t: string, w: string, l: string, q: string, p = ''): TimberInput => ({ t, w, l, q, p })
const extra = (d: string, q: string, u: ExtraInput['u'], p: string): ExtraInput => ({ d, q, u, p })
const quote = (patch: Partial<QuoteInput>): QuoteInput => ({ ...emptyQuote(), ...patch })
const totals = (q: QuoteInput) => computeQuote(q, 'tr').totals
const codes = (q: QuoteInput) =>
  computeQuote(q, 'tr').errors.map((e) => `${e.metadata?.get('section')}${e.metadata?.get('row')}.${e.metadata?.get('field')}:${e.code}`)

describe('audit cases A–G (old app output → corrected value)', () => {
  it('A: 5×10×400 cm, 10 pcs, 20 000 ₺/m³ → 0,2 m³ / 4 000,00 / 800,00 / 4 800,00', () => {
    const t = totals(quote({ timber: [row('5', '10', '400', '10', '20000')] }))
    expect(t.m3).toBeCloseTo(0.2, 12)
    expect([t.timberKurus, t.subtotalKurus, t.vatKurus, t.grandKurus]).toEqual([400_000, 400_000, 80_000, 480_000])
  })

  it('B: "2,5" is 2.5 cm, not 25 (old: 1,00 m³ / 24 000) → 0,1 m³ / 2 000,00 / 400,00 / 2 400,00', () => {
    const t = totals(quote({ timber: [row('2,5', '10', '400', '10', '20000')] }))
    expect(t.m3).toBeCloseTo(0.1, 12)
    expect([t.subtotalKurus, t.vatKurus, t.grandKurus]).toEqual([200_000, 40_000, 240_000])
  })

  it('C: 1.8×10.1×300, 3 pcs, 12 345 → 0,016362 m³ / 201,99 / 40,40 / 242,39 (old lost the kuruş)', () => {
    const q = computeQuote(quote({ timber: [row('1.8', '10.1', '300', '3', '12345')] }), 'tr')
    expect(q.totals.m3).toBeCloseTo(0.016362, 12)
    // 0.016362 × 12 345 = 201.98889 → 201,99; 20 199 × 0.20 = 4 039.8 → 40,40; 201,99 + 40,40 = 242,39
    expect([q.totals.subtotalKurus, q.totals.vatKurus, q.totals.grandKurus]).toEqual([20_199, 4_040, 24_239])
    expect(Result.isSuccess(q.timber[0]!) && q.timber[0].value?.kurus).toBe(20_199)
  })

  it('D: 2×5×40, 1 pc, 20 000 → 0,0004 m³ (old showed 0,00) / 8,00 / 1,60 / 9,60', () => {
    const t = totals(quote({ timber: [row('2', '5', '40', '1', '20000')] }))
    expect(t.m3).toBeCloseTo(0.0004, 12)
    expect([t.subtotalKurus, t.vatKurus, t.grandKurus]).toEqual([800, 160, 960])
  })

  it('F: 5×10×100, 1 pc, 20 500 → 102,50 + 20,50 = 123,00 (old showed 103 + 21 = 123)', () => {
    const t = totals(quote({ timber: [row('5', '10', '100', '1', '20500')] }))
    expect([t.subtotalKurus, t.vatKurus, t.grandKurus]).toEqual([10_250, 2_050, 12_300])
    expect(t.subtotalKurus + t.vatKurus).toBe(t.grandKurus)
  })

  it('G: a negative dimension, a fractional piece count and an empty field are errors, and the row is left out', () => {
    const q = quote({ timber: [row('-5', '10', '400', '10', '20000'), row('5', '10', '400', '2,5', '20000'), row('5', '', '400', '10', '20000')] })
    expect(codes(q)).toEqual(['timber0.t:Calc.NotPositive', 'timber1.q:Calc.NotInteger', 'timber2.w:Calc.Required'])
    expect(computeQuote(q, 'tr').ok).toBe(false)
    expect(totals(q).grandKurus).toBe(0)
  })
})

describe('units, waste, extra items and KDV (owner decisions 2026-10-19)', () => {
  it('mm and m: 25 mm × 100 mm × 4 m, 10 pcs, 20 000 → 0,1 m³ / 2 000,00 (same wood as B)', () => {
    const t = totals(quote({ units: ['mm', 'mm', 'm'], timber: [row('25', '100', '4', '10', '20000')] }))
    expect(t.m3).toBeCloseTo(0.1, 12)
    expect(t.timberKurus).toBe(200_000)
  })

  it('waste 10 % on A → +0,02 m³ / +400,00; subtotal 4 400,00; KDV 880,00; total 5 280,00', () => {
    const t = totals(quote({ timber: [row('5', '10', '400', '10', '20000')], waste: '10' }))
    expect(t.wasteM3).toBeCloseTo(0.02, 12)
    expect([t.timberKurus, t.wasteKurus, t.subtotalKurus, t.vatKurus, t.grandKurus]).toEqual([400_000, 40_000, 440_000, 88_000, 528_000])
  })

  it('extra items: 2,5 kg × 180 = 450,00; götürü is always 1 × price', () => {
    const q = computeQuote(quote({ extras: [extra('Vida', '2,5', 'kg', '180'), extra('Nakliye', '3', 'goturu', '1.500')] }), 'tr')
    expect(q.extras.map((r) => Result.isSuccess(r) && r.value?.kurus)).toEqual([45_000, 150_000])
    expect(q.totals.extrasKurus).toBe(195_000)
  })

  it('A + both extras → subtotal 5 950,00; KDV 1 190,00; total 7 140,00', () => {
    const t = totals(quote({ timber: [row('5', '10', '400', '10', '20.000')], extras: [extra('Vida', '2,5', 'kg', '180'), extra('Nakliye', '', 'goturu', '1500')] }))
    expect([t.subtotalKurus, t.vatKurus, t.grandKurus]).toEqual([595_000, 119_000, 714_000])
  })

  it.each([
    [{ on: true, rate: 10 }, 1_025, 11_275],
    [{ on: true, rate: 1 }, 103, 10_353], // 102,5 kuruş rounds half up
    [{ on: true, rate: 0 }, 0, 10_250],
    [{ on: false, rate: 20 }, 0, 10_250],
  ] as const)('KDV %j on F (102,50) → %i kuruş, total %i', (vat, vatKurus, grand) => {
    const t = totals(quote({ timber: [row('5', '10', '100', '1', '20500')], vat }))
    expect([t.vatKurus, t.grandKurus]).toEqual([vatKurus, grand])
  })

  it('a row without a price still counts its volume, and adds nothing to the amount', () => {
    const q = computeQuote(quote({ timber: [row('5', '10', '400', '10')] }), 'tr')
    expect(q.ok).toBe(true)
    expect(q.totals.m3).toBeCloseTo(0.2, 12)
    expect(q.totals.grandKurus).toBe(0)
  })

  it('blank rows are ignored; an extra needs a description and a price once anything is typed', () => {
    const q = quote({ timber: [row('', '', '', '')], extras: [extra('', '', 'adet', ''), extra('', '2', 'adet', '')] })
    expect(codes(q)).toEqual(['extras1.d:Calc.Required', 'extras1.p:Calc.Required'])
  })

  it('rejects out-of-range values', () => {
    const q = quote({ timber: [row('5', '10', '2001', '0', '-1')], waste: '150', extras: [extra('Boya', '0', 'litre', '10')] })
    expect(codes(q)).toEqual(['timber0.l:Calc.TooLarge', 'timber0.q:Calc.NotPositive', 'timber0.p:Calc.Negative', 'extras0.q:Calc.NotPositive', 'waste0.waste:Calc.OutOfRange'])
  })

  it('warns (without blocking) when a length looks like metres typed into cm', () => {
    const q = computeQuote(quote({ timber: [row('5', '10', '4', '10', '20000')] }), 'tr')
    expect(q.ok).toBe(true)
    expect(Result.isSuccess(q.timber[0]!) && q.timber[0].value?.suspiciousLength).toBe(true)
  })
})

describe('the totals are always the sum of the lines shown', () => {
  it('E: delete a row, add a new one → totals follow the current rows (old app kept the deleted state)', () => {
    const a = row('5', '10', '400', '10', '20000')
    const before = quote({ timber: [a, a] })
    const after = quote({ timber: [...before.timber.slice(1), a] }) // one deleted, one added and filled
    const t = totals(after)
    expect(t.m3).toBeCloseTo(0.4, 12)
    expect([t.subtotalKurus, t.vatKurus, t.grandKurus]).toEqual([800_000, 160_000, 960_000])
  })

  it('row amounts + waste + extras = subtotal and subtotal + KDV = total, over many random quotes', () => {
    let seed = 7
    const rnd = (max: number) => ((seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) % max) + 1
    const dec = () => `${rnd(400)},${rnd(99)}`
    for (let i = 0; i < 500; i++) {
      const q = computeQuote(
        quote({
          timber: Array.from({ length: rnd(5) }, () => row(dec(), dec(), dec(), String(rnd(50)), `${rnd(60_000)},${rnd(99)}`)),
          waste: String(rnd(15)),
          extras: Array.from({ length: rnd(3) }, () => extra('x', dec(), 'kg', `${rnd(900)},${rnd(99)}`)),
          vat: { on: true, rate: ([20, 10, 1, 0] as const)[rnd(4) - 1]! },
        }),
        'tr',
      )
      const lines = [...q.timber, ...q.extras].map((r: Result<{ kurus: number | null } | null>) => (r.ok ? (r.value?.kurus ?? 0) : 0))
      expect(lines.reduce((s, k) => s + k, 0) + q.totals.wasteKurus).toBe(q.totals.subtotalKurus)
      expect(q.totals.subtotalKurus + q.totals.vatKurus).toBe(q.totals.grandKurus)
    }
  })
})

describe('roundHalfUp', () => {
  it.each([
    [1025n, 1, 103], // 102.5 → 103
    [1024n, 1, 102],
    [20_198_889n, 5, 202], // 201.98889 → 202
    [5n, 0, 5],
  ])('%s / 10^%i → %i', (n, s, expected) => {
    expect(roundHalfUp(n, s)).toBe(expected)
  })
})
