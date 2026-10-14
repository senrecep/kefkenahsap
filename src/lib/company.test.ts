import { describe, expect, it } from 'vitest'
import { Maybe } from 'tsentials/maybe'
import { createFakeDateTimeProvider } from 'tsentials/time'

import { craftYears, sinceYear } from './company'

const clock = createFakeDateTimeProvider(new Date('2026-10-14T12:00:00Z'))

describe('company claims render only from confirmed facts', () => {
  it('"since" year comes from the founding year, nothing otherwise', () => {
    expect(sinceYear({ foundingYear: 2009 })).toEqual(Maybe.some(2009))
    expect(Maybe.isNone(sinceYear({}))).toBe(true)
    expect(Maybe.isNone(sinceYear({ foundingYear: null }))).toBe(true)
  })

  it('years of craft are computed only from the confirmed craft start year, never from the founding year', () => {
    expect(craftYears({ craftStartYear: 1990 }, clock)).toEqual(Maybe.some(36))
    expect(Maybe.isNone(craftYears({ foundingYear: 2009 }, clock))).toBe(true)
  })

  it('ignores implausible years', () => {
    expect(Maybe.isNone(sinceYear({ foundingYear: 3020 }))).toBe(true)
    expect(Maybe.isNone(craftYears({ craftStartYear: 1800 }, clock))).toBe(true)
  })
})
