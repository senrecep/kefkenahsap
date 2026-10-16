import { describe, expect, it } from 'vitest'

import { knownTypes, TAG_IMAGE_PROMPT_VERSION, TagImageSchema, tagImageSystem, tagImageTypesLine } from './tagImage'

const TYPES = ['Deck', 'Pergola', 'Köpek kulübesi', 'Bahçe kulübesi / depo']

describe('tagImage prompt: product type axis (#171)', () => {
  it('is tagImage@3', () => {
    expect(TAG_IMAGE_PROMPT_VERSION).toBe('tagImage@3')
  })

  it('accepts at most 3 types; a v2 output without types reads as none', () => {
    const v2 = { title: { tr: 'Ahşap deck', en: 'Timber deck' }, alt: { tr: 'Bahçede ahşap deck', en: 'A timber deck' }, caption: { tr: '', en: '' }, seoFilename: 'ahsap-deck', tags: { wood: [], setting: [], finish: [], stage: [] }, categoryAgrees: true, confidence: 0.8 }
    const parsed = TagImageSchema.safeParse(v2)
    expect(parsed.success && parsed.data.tags.type).toEqual([])
    expect(TagImageSchema.safeParse({ ...v2, tags: { ...v2.tags, type: ['a', 'b', 'c', 'd'] } }).success).toBe(false)
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
