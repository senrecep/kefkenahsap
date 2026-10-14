import { describe, expect, it } from 'vitest'
import { Maybe } from 'tsentials/maybe'

import { categoryFilter, projectFacts } from './facts'

const units = { m2: 'm²', m: 'metre', piece: 'adet' }

describe('projectFacts (Proje künyesi)', () => {
  it('renders nothing for an empty project', () => {
    expect(projectFacts({}, 'tr', units)).toEqual([])
    expect(projectFacts({ city: '', district: null, woodSpecies: [], categories: [], duration: '  ' }, 'tr', units)).toEqual([])
  })

  it('lists only the filled fields, in a fixed order', () => {
    const facts = projectFacts(
      {
        city: 'İstanbul',
        district: 'Beykoz',
        year: 2019,
        areaValue: 1250,
        areaUnit: 'm2',
        duration: '3 hafta',
        woodSpecies: [{ name: 'Iroko' }, { name: 'Teak' }],
        finish: 'Doğal yağ',
        categories: [{ name: 'Deck ve Zeminler' }],
      },
      'tr',
      units,
    )
    expect(facts).toEqual([
      { key: 'location', value: 'Beykoz, İstanbul' },
      { key: 'year', value: '2019' },
      { key: 'area', value: '1.250 m²' },
      { key: 'duration', value: '3 hafta' },
      { key: 'wood', value: ['Iroko', 'Teak'] },
      { key: 'finish', value: 'Doğal yağ' },
      { key: 'categories', value: ['Deck ve Zeminler'] },
    ])
  })

  it('skips unpopulated relation ids and an area without a value', () => {
    expect(projectFacts({ city: 'Bodrum', areaUnit: 'm2', woodSpecies: [3], categories: [7] }, 'tr', units)).toEqual([
      { key: 'location', value: 'Bodrum' },
    ])
  })
})

describe('categoryFilter (?kategori=)', () => {
  const cats = [
    { id: 174, slug: 'deck-ve-zeminler' },
    { id: 187, slug: 'pergola-ve-kamelyalar' },
  ]
  it('maps a known category slug to its id', () => {
    expect(categoryFilter('pergola-ve-kamelyalar', cats)).toEqual(Maybe.some({ id: 187, slug: 'pergola-ve-kamelyalar' }))
  })
  it('ignores unknown, empty or repeated params', () => {
    expect(Maybe.isNone(categoryFilter('yok', cats))).toBe(true)
    expect(Maybe.isNone(categoryFilter(undefined, cats))).toBe(true)
    expect(Maybe.isNone(categoryFilter(['deck-ve-zeminler', 'x'], cats))).toBe(true)
  })
})
