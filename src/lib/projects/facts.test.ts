import { describe, expect, it } from 'vitest'
import { Maybe } from 'tsentials/maybe'

import { categoryChips, categoryFilter, projectFacts } from './facts'

const units = { m2: 'm²', m: 'metre', piece: 'adet' }

describe('projectFacts (Proje künyesi)', () => {
  it('renders nothing for an empty project', () => {
    expect(projectFacts({}, 'tr', units)).toEqual([])
    expect(projectFacts({ city: '', district: null, woodSpecies: [], duration: '  ' }, 'tr', units)).toEqual([])
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
    ])
  })

  it('skips unpopulated relation ids and an area without a value', () => {
    expect(projectFacts({ city: 'Bodrum', areaUnit: 'm2', woodSpecies: [3] }, 'tr', units)).toEqual([
      { key: 'location', value: 'Bodrum' },
    ])
  })
})

describe('künye vs. category chips (#147)', () => {
  it('a project with only categories has no künye (no card of one "Kategori" row)', () => {
    // A project doc as the page passes it: categories are on it but are not a künye fact.
    const project = { title: 'İskele', city: null, year: null, categories: [{ name: 'Köprü ve İskele' }] }
    expect(projectFacts(project, 'tr', units)).toEqual([])
  })

  it('category chips keep only populated categories that have a name and a slug, in order', () => {
    expect(
      categoryChips([{ name: 'Köprü ve İskele', slug: 'kopru-ve-iskele' }, 7, null, { name: 'Taslak', slug: null }, { name: ' ', slug: 'bos' }, { name: 'Deck ve Zeminler', slug: 'deck-ve-zeminler' }]),
    ).toEqual([
      { name: 'Köprü ve İskele', slug: 'kopru-ve-iskele' },
      { name: 'Deck ve Zeminler', slug: 'deck-ve-zeminler' },
    ])
    expect(categoryChips(undefined)).toEqual([])
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
