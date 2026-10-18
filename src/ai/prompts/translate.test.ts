import { describe, expect, it } from 'vitest'
import { Result } from 'tsentials/result'

import { DEFAULT_GLOSSARY, glossaryFrom, toSegmentMap, translateInput, translateSchema, translateSystem } from './translate'

describe('translate prompt: glossary', () => {
  it('defaults to the CONTENT-STYLE-TR §8 table when AI Ayarları has none', () => {
    const g = glossaryFrom([])
    expect(g).toBe(DEFAULT_GLOSSARY)
    // Rows copied by hand from docs/CONTENT-STYLE-TR.md §8.
    expect(g).toContainEqual({ tr: 'kamelya', en: 'gazebo' })
    expect(g).toContainEqual({ tr: 'emprenyeli çam', en: 'pressure-treated pine' })
    expect(g).toContainEqual({ tr: 'korkuluk', en: 'railing; balustrade' })
    expect(g).toContainEqual({ tr: 'keşif', en: 'site visit' })
  })

  it('the admin glossary replaces the default (admin record wins, §8)', () => {
    const g = glossaryFrom([{ tr: 'kamelya', en: 'garden gazebo' }, { tr: ' ', en: 'x' }])
    expect(g).toEqual([{ tr: 'kamelya', en: 'garden gazebo' }])
  })

  it('puts every glossary pair, the language pair and the Turkish rules into the system prompt', () => {
    const s = translateSystem({ glossary: [{ tr: 'kamelya', en: 'gazebo' }, { tr: 'emprenye', en: 'pressure-treated' }], source: 'tr', targets: ['en'] })
    expect(s).toContain('kamelya = gazebo')
    expect(s).toContain('emprenye = pressure-treated')
    expect(s).toContain('tr → en')
    expect(s).toContain('Türkçe yazım kuralları')
  })
})

describe('translate prompt: one call for all target languages', () => {
  const segs = [{ id: 'f:title', text: 'Kamelya' }, { id: 'r:body:0', text: 'Emprenyeli çam ' }]

  it('sends segments and every target locale in one input', () => {
    expect(JSON.parse(translateInput(segs, 'tr', ['en', 'ar']))).toEqual({ source: 'tr', targets: ['en', 'ar'], segments: segs })
  })

  it('schema asks for one string per target locale per segment', () => {
    const ok = translateSchema(['en', 'ar']).safeParse({ items: [{ id: 'f:title', en: 'Gazebo', ar: 'x' }] })
    expect(ok.success).toBe(true)
    expect(translateSchema(['en', 'ar']).safeParse({ items: [{ id: 'f:title', en: 'Gazebo' }] }).success).toBe(false)
  })

  it('maps answers back per locale and restores the edge spaces Lexical needs between nodes', () => {
    const r = toSegmentMap({ items: [{ id: 'f:title', en: 'Gazebo' }, { id: 'r:body:0', en: 'Pressure-treated pine' }] }, segs, ['en'])
    expect(Result.isSuccess(r) && r.value).toEqual({ en: { 'f:title': 'Gazebo', 'r:body:0': 'Pressure-treated pine ' } })
  })

  it('fails with Translate.SchemaMismatch when a segment is missing or empty', () => {
    const r = toSegmentMap({ items: [{ id: 'f:title', en: 'Gazebo' }, { id: 'r:body:0', en: ' ' }] }, segs, ['en'])
    expect(Result.isFailure(r) && r.errors[0]?.code).toBe('Translate.SchemaMismatch')
  })
})
