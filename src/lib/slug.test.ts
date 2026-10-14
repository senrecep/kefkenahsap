import { describe, expect, it } from 'vitest'
import { Result } from 'tsentials/result'

import { slugify } from './slug'

const value = (input: string, max?: number) => {
  const r = slugify(input, max)
  if (!Result.isSuccess(r)) throw new Error(`expected success for "${input}"`)
  return r.value
}

describe('slugify', () => {
  it('transliterates Turkish letters, including dotted/dotless i', () => {
    // Expected values written by hand from the Turkish alphabet, not from the implementation.
    expect(value('Çiçeklik ve Oturma Grubu')).toBe('ciceklik-ve-oturma-grubu')
    expect(value('Köprü ve İskele')).toBe('kopru-ve-iskele')
    expect(value('IŞIK ağaç ÜSTÜ')).toBe('isik-agac-ustu')
    expect(value('Boya, Tamir ve Bakım')).toBe('boya-tamir-ve-bakim')
  })

  it('keeps the existing WordPress category slugs stable', () => {
    expect(value('Deck ve Zeminler')).toBe('deck-ve-zeminler')
    expect(value('Kapı, Dolap ve Seperatör')).toBe('kapi-dolap-ve-seperator')
    expect(value('Pergola ve Kamelyalar')).toBe('pergola-ve-kamelyalar')
  })

  it('collapses punctuation and whitespace and trims dashes', () => {
    expect(value('  Iroko -- Teak!!  (2019) ')).toBe('iroko-teak-2019')
  })

  it('cuts at a word boundary within the max length', () => {
    const s = value('iroko havuz kenari deck bahcesehir villa projesi', 30)
    expect(s).toBe('iroko-havuz-kenari-deck')
    expect(s.length).toBeLessThanOrEqual(30)
  })

  it('fails with Slug.Empty when nothing usable remains', () => {
    const r = slugify('  !!! ... ')
    expect(Result.isFailure(r)).toBe(true)
    if (Result.isFailure(r)) expect(r.errors[0]?.code).toBe('Slug.Empty')
  })
})
