import { describe, expect, it } from 'vitest'

import tr from '../../../messages/tr/calculator.json'
import { computeQuote, emptyQuote, type QuoteInput } from '@/lib/calc/quote'

import { buildSheet } from './sheet'

const ui = { ...tr.Calculator.ui, title: tr.Calculator.title }
const plain = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ').replace(/[\u2066\u2069]/g, '')

describe('buildSheet (the PNG / print content)', () => {
  it('lists the rows, totals and branding of case A with extras, KDV 20 % (hand-computed: 5 950,00 + 1 190,00 = 7 140,00)', () => {
    const input: QuoteInput = {
      ...emptyQuote(),
      timber: [{ t: '5,0', w: '10', l: '400', q: '10', p: '20.000,00' }, { t: '', w: '', l: '', q: '', p: '' }],
      extras: [{ d: 'Vida', q: '2.5', u: 'kg', p: '180' }, { d: 'Nakliye', q: '', u: 'goturu', p: '1500' }],
      meta: { customer: 'Ahmet Bey', job: '', note: '' },
    }
    const s = buildSheet(input, computeQuote(input, 'tr'), ui, 'tr', new Date('2026-10-19T11:33:00Z'))
    expect(s.title).toBe('Malzeme ve teklif hesaplayıcı')
    expect(s.customer).toBe('Müşteri: Ahmet Bey')
    expect(s.note).toBeUndefined()
    expect(plain(s.stamp!)).toBe('19 Ekim 2026 14:33 TSİ')
    // Parsed values, formatted for the page: '5,0' → 5, '20.000,00' → ₺20.000,00, '2.5' → 2,5 (#236 review).
    expect(s.timber.map((l) => [plain(l.text), plain(l.sub!), l.value])).toEqual([['5 × 10 × 400 cm · 10 adet', '0,200 m³ · ₺20.000,00/m³', '₺4.000,00']])
    expect(s.extras.map((l) => [l.text, plain(l.sub!), l.value])).toEqual([
      ['Vida', '2,5 kg × ₺180,00', '₺450,00'],
      ['Nakliye', 'götürü', '₺1.500,00'],
    ])
    expect(s.totals.map((l) => `${l.text}=${plain(l.value)}`)).toEqual([
      'Kereste hacmi=0,200 m³',
      'Kereste tutarı=₺4.000,00',
      'Ek kalemler=₺1.950,00',
      'Ara toplam=₺5.950,00',
      'KDV (%20)=₺1.190,00',
    ])
    expect(s.grand.value).toBe('₺7.140,00')
    // Arabic text keeps the numbers of a row in reading order: the dimensions are one left-to-right isolate.
    expect(s.timber[0]!.text.startsWith('\u20665 × 10 × 400 cm\u2069')).toBe(true)
    expect(s.footer).toContain('Sonuçlar tahminidir; kesin fiyat için keşif gerekir.')
    expect(s.footer).toContain('Kefken Ahşap malzeme ve teklif hesaplayıcı ile hazırlanmıştır')
  })
})
