import { describe, expect, it } from 'vitest'

import { fillPlaceholders, fillTemplate, unfilledFields } from './placeholders'

const text = (t: string, format = 0) => ({ type: 'text', text: t, format, detail: 0, mode: 'normal', style: '', version: 1 })
const p = (...children: object[]) => ({ type: 'paragraph', direction: null, format: '', indent: 0, version: 1, textFormat: 0, children })
const doc = (...children: object[]) => ({ root: { type: 'root', direction: null, format: '', indent: 0, version: 1, children } }) as never

const lead = { name: 'Ayşe Yılmaz', service: 'Ahşap deck', district: 'Şile', city: 'İstanbul' }

describe('fillPlaceholders', () => {
  it('fills {ad}, {hizmet} and {konum} from the lead, every occurrence', () => {
    expect(fillPlaceholders('Merhaba {ad}, {hizmet} talebiniz ({konum}) için {ad} Hanım', lead)).toBe(
      'Merhaba Ayşe Yılmaz, Ahşap deck talebiniz (Şile, İstanbul) için Ayşe Yılmaz Hanım',
    )
  })

  it('uses whichever of district / city exists for {konum}', () => {
    expect(fillPlaceholders('{konum}', { city: 'Kocaeli' })).toBe('Kocaeli')
    expect(fillPlaceholders('{konum}', { district: 'Kandıra', city: '  ' })).toBe('Kandıra')
  })

  it('leaves empty, missing and unknown placeholders visible as [name]', () => {
    expect(fillPlaceholders('Merhaba {ad}, {hizmet} — {fiyat}', { name: '  ', service: null })).toBe('Merhaba [ad], [hizmet] — [fiyat]')
    expect(fillPlaceholders('Talebiniz hakkında — {hizmet}', undefined)).toBe('Talebiniz hakkında — [hizmet]')
  })

  it('keeps text without placeholders and hand-filled [..] parts as they are', () => {
    expect(fillPlaceholders('**Tarih:** [gün, tarih] {', lead)).toBe('**Tarih:** [gün, tarih] {')
  })
})

describe('fillTemplate', () => {
  const body = doc(p(text('Merhaba {ad},')), p(text('{hizmet}', 1), text(' talebinizi aldık.')), {
    type: 'block',
    version: 2,
    format: '',
    fields: { id: 'a', blockName: '', blockType: 'button', label: "WhatsApp'tan yazın", url: 'https://wa.me/905322958416', style: 'dolu' },
  })

  it('fills the subject and every text node of a copy of the body; the template stays untouched', () => {
    const before = JSON.stringify(body)
    const out = fillTemplate({ subject: 'Talebiniz hakkında — {hizmet}', body }, lead)
    expect(out.subject).toBe('Talebiniz hakkında — Ahşap deck')
    const root = (out.body as { root: { children: { children?: { text: string; format: number }[] }[] } }).root
    expect(root.children[0]!.children![0]!.text).toBe('Merhaba Ayşe Yılmaz,')
    expect(root.children[1]!.children![0]).toMatchObject({ text: 'Ahşap deck', format: 1 })
    expect(root.children[2]).toMatchObject({ type: 'block', fields: { blockType: 'button', url: 'https://wa.me/905322958416' } })
    expect(JSON.stringify(body)).toBe(before)
  })
})

describe('unfilledFields', () => {
  it('lists [..] and {..} parts left in the subject and body, once each', () => {
    const body = doc(p(text('**Tarih:** '), text('[gün, tarih]')), p(text('Merhaba {ad}, '), text('[gün, tarih]')))
    expect(unfilledFields('Keşif — [hizmet]', body)).toEqual(['[hizmet]', '[gün, tarih]', '{ad}'])
  })

  it('finds a bracket split over formatted text nodes but not across paragraphs', () => {
    expect(unfilledFields('', doc(p(text('['), text('tarih', 1), text(']'))))).toEqual(['[tarih]'])
    expect(unfilledFields('', doc(p(text('a [')), p(text('b ]'))))).toEqual([])
  })

  it('is empty for a finished e-mail', () => {
    expect(unfilledFields('Talebiniz hakkında — Deck', doc(p(text('Merhaba Ayşe Hanım, keşif için yarın uygunuz.'))))).toEqual([])
    expect(unfilledFields('Konu', null)).toEqual([])
  })
})
