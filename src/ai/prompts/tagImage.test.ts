import { describe, expect, it } from 'vitest'

import { knownTypes, StoredTagImageSchema, TAG_IMAGE_PROMPT_VERSION, TagImageSchema, tagImageSystem, tagImageTypesLine } from './tagImage'

const TYPES = ['Deck', 'Pergola', 'Köpek kulübesi', 'Bahçe kulübesi / depo']
const tags = { type: [], wood: [], setting: [], finish: [], stage: [] }
const v3 = { title: { tr: 'Ahşap deck', en: 'Timber deck' }, alt: { tr: 'Bahçede ahşap deck', en: 'A timber deck' }, caption: { tr: '', en: '' }, seoFilename: 'ahsap-deck', tags, categoryAgrees: true, confidence: 0.8 }
// Every site locale (tr en ru de ar), spelled out here so a locale added to routing must be added here too.
const all = <T>(v: T) => ({ tr: v, en: v, ru: v, de: v, ar: v })
const v4 = { ...v3, title: all('Ahşap deck'), alt: all('Bahçede ahşap deck'), caption: all('') }

describe('tagImage prompt: product type axis (#171)', () => {
  it('requires at most 3 types from the model; a stored v2 output without types reads as none', () => {
    const v2 = { ...v4, tags: { wood: [], setting: [], finish: [], stage: [] } }
    expect(TagImageSchema.safeParse(v2).success).toBe(false)
    const stored = StoredTagImageSchema.safeParse(v2)
    expect(stored.success && stored.data.tags.type).toEqual([])
    expect(TagImageSchema.safeParse({ ...v4, tags: { ...tags, type: ['a', 'b', 'c', 'd'] } }).success).toBe(false)
  })

  it('tells the model to pick types only from the given list and leave it empty when unsure', () => {
    const system = tagImageSystem('2026-10-16')
    expect(system).toContain('Ürün türleri')
    expect(system).toMatch(/emin değilsen type dizisi boş/i)
    expect(tagImageTypesLine(TYPES)).toBe('Ürün türleri: ["Deck","Pergola","Köpek kulübesi","Bahçe kulübesi / depo"]')
  })

  it('keeps only names from the list, as the list spells them, deduplicated, at most 3', () => {
    expect(knownTypes(['deck', 'KÖPEK KULÜBESİ', 'Uydurma tür', 'Deck '], TYPES)).toEqual(['Deck', 'Köpek kulübesi'])
    expect(knownTypes(['Deck', 'Pergola', 'Köpek kulübesi', 'Bahçe kulübesi / depo'], TYPES)).toEqual(['Deck', 'Pergola', 'Köpek kulübesi'])
    expect(knownTypes(['Deck'], [])).toEqual([])
  })
})

describe('tagImage@4: texts in every site locale (#192)', () => {
  it('is tagImage@4', () => {
    expect(TAG_IMAGE_PROMPT_VERSION).toBe('tagImage@4')
  })

  it('requires title, alt and caption in every locale, with the same limits', () => {
    expect(TagImageSchema.safeParse(v4).success).toBe(true)
    expect(TagImageSchema.safeParse(v3).success).toBe(false)
    expect(TagImageSchema.safeParse({ ...v4, alt: { ...v4.alt, ar: 'x'.repeat(126) } }).success).toBe(false)
    expect(TagImageSchema.safeParse({ ...v4, title: { ...v4.title, de: 'ab' } }).success).toBe(false)
    expect(TagImageSchema.safeParse({ ...v4, caption: { ...v4.caption, ru: 'x'.repeat(241) } }).success).toBe(false)
  })

  it('still reads a stored TR/EN-only suggestion (tagImage@2/@3)', () => {
    const stored = StoredTagImageSchema.safeParse(v3)
    expect(stored.success && stored.data.alt).toEqual({ tr: 'Bahçede ahşap deck', en: 'A timber deck' })
    expect(StoredTagImageSchema.safeParse({ ...v3, alt: { en: 'A timber deck' } }).success).toBe(false)
  })

  it('asks for every locale and carries the house terms per language', () => {
    const system = tagImageSystem('2026-10-17')
    for (const l of ['tr', 'en', 'ru', 'de', 'ar']) expect(system).toContain(`"${l}"`)
    // PR #181 terminology: AR deck is ديكينغ (not ديك), kamelya is كشك (not كاميليا); DE deck boards are Terrassendielen.
    expect(system).toContain('ديكينغ')
    expect(system).toContain('كشك')
    expect(system).toContain('Terrassendielen')
    expect(system).toContain('настил')
    expect(system).toMatch(/Modern Standart Arapça|MSA/)
  })
})
