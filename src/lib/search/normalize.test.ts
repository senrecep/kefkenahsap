import { describe, expect, it } from 'vitest'
import { Result } from 'tsentials/result'

import { foldText, normalizeQuery, prefixTsQuery } from './normalize'

describe('foldText (Turkish-aware folding, mirrors SQL search_norm)', () => {
  it.each([
    ['İSTANBUL', 'istanbul'],
    ['IŞIK', 'isik'],
    ['ışık', 'isik'],
    ['Çiçeklik ve Oturma Grubu', 'ciceklik ve oturma grubu'],
    ['KÖPRÜ İSKELE', 'kopru iskele'],
    ['Ağaç', 'agac'],
    ['Straße Æsir Øresund Łódź', 'strasse aesir oresund lodz'],
    ['i\u0307stanbul', 'istanbul'],
  ])('%s → %s', (input, expected) => {
    expect(foldText(input)).toBe(expected)
  })

  it('treats decomposed (NFD) input like composed input', () => {
    expect(foldText('Çiçek'.normalize('NFD'))).toBe(foldText('Çiçek'))
  })
})

describe('normalizeQuery', () => {
  const ok = (q: string) => {
    const r = normalizeQuery(q)
    if (!Result.isSuccess(r)) throw new Error(`expected success for ${q}`)
    return r.value
  }
  const code = (q: string) => {
    const r = normalizeQuery(q)
    return Result.isFailure(r) ? r.errors[0]!.code : null
  }

  it('folds, trims and collapses whitespace', () => {
    expect(ok('  Pergola   ve  KAMELYA ')).toEqual({ text: 'pergola ve kamelya', tokens: ['pergola', 've', 'kamelya'] })
  })

  it('drops punctuation and SQL/tsquery syntax characters', () => {
    expect(ok("deck & (zemin) | 'iroko':* 100%_\\")).toEqual({
      text: 'deck zemin iroko 100',
      tokens: ['deck', 'zemin', 'iroko', '100'],
    })
  })

  it('rejects queries shorter than 2 characters after normalization', () => {
    expect(code('')).toBe('Search.QueryTooShort')
    expect(code(' a ')).toBe('Search.QueryTooShort')
    expect(code('!!')).toBe('Search.QueryTooShort')
  })

  it('rejects queries longer than 100 characters', () => {
    expect(code('a'.repeat(101))).toBe('Search.QueryTooLong')
  })
})

describe('prefixTsQuery', () => {
  it('ANDs prefix terms', () => {
    expect(prefixTsQuery(['deck', 'iroko'])).toBe('deck:* & iroko:*')
  })
})
