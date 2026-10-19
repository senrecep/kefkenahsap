import { describe, expect, it } from 'vitest'
import { Result } from 'tsentials/result'

import { canonical, forLocale, parseDecimal, parseMoney } from './number'

const code = (r: Result<unknown>) => (Result.isFailure(r) ? r.errors[0]?.code : 'ok')
// Expected values are the decimals written as mantissa / 10^scale by hand.
const dec = (n: number, s: number) => Result.success({ n: BigInt(n), s })
const NBSP = '\u00a0'

// Owner decision 2026-10-19: what the user types is read with the page language's own conventions (tr/de: "." groups,
// "," decimal; en/ar: "," groups, "." decimal; ru: space groups, "," decimal). Storage is canonical (codec.ts).
describe('parseDecimal (dimensions, pieces, quantities, waste) per page language', () => {
  it.each([
    ['tr', '2,5', dec(25, 1)], // bug B: the comma is a decimal separator, never dropped
    ['tr', '2.5', dec(25, 1)], // phone keypads: a dot not followed by three digits is a decimal
    ['tr', '2.55', dec(255, 2)],
    ['tr', '1.000', dec(1000, 0)], // a thousand pieces
    ['tr', '2.400', dec(2400, 0)], // 2400 mm
    ['tr', '1.234.567', dec(1_234_567, 0)],
    ['tr', '1.000,5', dec(10_005, 1)],
    ['tr', '0.500', dec(500, 3)], // a leading 0 is never a thousands group
    ['tr', '0,016', dec(16, 3)],
    ['tr', '٢٫٥', dec(25, 1)], // Arabic-Indic digits + Arabic decimal separator
    ['tr', '۲.۵', dec(25, 1)], // Extended (Persian) digits
    ['tr', ' 400 ', dec(400, 0)],
    ['tr', '.5', dec(5, 1)],
    ['tr', '5,', dec(5, 0)], // mid-typing
    ['tr', '-5', dec(-5, 0)], // parses; validation rejects it (bug G)
    ['de', '2.400', dec(2400, 0)],
    ['de', '2,4', dec(24, 1)],
    ['en', '2.5', dec(25, 1)],
    ['en', '1,000', dec(1000, 0)],
    ['en', '2,5', dec(25, 1)], // a comma not followed by three digits is a decimal
    ['en', '1,000.5', dec(10_005, 1)],
    ['ar', '1,000', dec(1000, 0)],
    ['ar', '٢٬٤٠٠', dec(2400, 0)], // Arabic thousands separator
    ['ru', `1${NBSP}000`, dec(1000, 0)],
    ['ru', '1 000,5', dec(10_005, 1)],
    ['ru', '2,5', dec(25, 1)],
    ['ru', '2.5', dec(25, 1)],
  ])('%s %j', (locale, input, expected) => {
    expect(parseDecimal(input, locale)).toEqual(expected)
  })

  it.each([
    ['tr', '', 'Calc.Required'],
    ['tr', '   ', 'Calc.Required'],
    ['tr', 'abc', 'Calc.Invalid'],
    ['tr', '1,000.5', 'Calc.Ambiguous'], // en order on the Turkish page
    ['en', '1.000,5', 'Calc.Ambiguous'],
    ['ru', '1.000', 'Calc.Ambiguous'], // neither ru grouping nor decimal: a dot before three digits
    ['tr', '20.00.0', 'Calc.Invalid'], // wrong group sizes
    ['tr', '1.00.000', 'Calc.Invalid'],
    ['tr', '2,5,1', 'Calc.Invalid'],
    ['tr', '1e3', 'Calc.Invalid'],
  ])('%s rejects %j', (locale, input, expected) => {
    expect(code(parseDecimal(input, locale))).toBe(expected)
  })
})

describe('parseMoney: integer kuruş, read with the page language', () => {
  it.each([
    ['tr', '20.000', 2_000_000], // owner: on the Turkish page "20.000" is twenty thousand
    ['tr', '20000', 2_000_000],
    ['tr', '20.000,50', 2_000_050],
    ['tr', '12.345', 1_234_500],
    ['tr', '1,5', 150],
    ['tr', '1.5', 150],
    ['tr', '20.50', 2050],
    ['tr', '0', 0],
    ['tr', '٢٠٫٥', 2050],
    ['de', '20.000', 2_000_000],
    ['en', '20,000', 2_000_000],
    ['en', '20,000.50', 2_000_050],
    ['en', '20.5', 2050],
    ['ar', '20,000', 2_000_000],
    ['ar', '١٬٢٣٤٫٥', 123_450],
    ['ru', '20 000', 2_000_000],
    ['ru', `20${NBSP}000,5`, 2_000_050], // no-break space, as ru formats it
  ])('%s %j → %i kuruş', (locale, input, kurus) => {
    expect(parseMoney(input, locale)).toEqual(Result.success(kurus))
  })

  it.each([
    ['tr', '', 'Calc.Required'],
    ['tr', '-1', 'Calc.Negative'],
    ['tr', '1,555', 'Calc.TooManyDecimals'],
    ['tr', '20,500', 'Calc.TooManyDecimals'], // counted before trailing zeros are dropped (was read as 20,50)
    ['tr', '1.000,555', 'Calc.TooManyDecimals'],
    ['tr', '1,000.50', 'Calc.Ambiguous'],
    ['en', '20.000', 'Calc.TooManyDecimals'], // en: the dot is the decimal point, so three decimals, never a silent 20 ₺
    ['tr', '20.00.0', 'Calc.Invalid'],
    ['tr', 'abc', 'Calc.Invalid'],
  ])('%s rejects %j', (locale, input, expected) => {
    expect(code(parseMoney(input, locale))).toBe(expected)
  })
})

describe('canonical storage ↔ the page language (links, saved quotes, remembered items)', () => {
  it.each([
    ['tr', '20.000,50', '20000.50', '20000,50'],
    ['tr', '2.5', '2.5', '2,5'],
    ['tr', '0,016', '0.016', '0,016'],
    ['en', '1,000.5', '1000.5', '1000.5'],
    ['ru', '1 000,5', '1000.5', '1000,5'],
    ['ar', '٢٬٤٠٠', '2400', '2400'],
    ['tr', '-5', '-5', '-5'],
  ])('%s %j → stored %j → typed back %j, read the same', (locale, typed, stored, back) => {
    const r = parseDecimal(typed, locale)
    expect(Result.isSuccess(r) && canonical(r.value)).toBe(stored)
    expect(forLocale(stored, locale)).toBe(back)
    expect(parseDecimal(back, locale)).toEqual(r)
  })
  it('a canonical value with three decimals reads right on every page ("1.125" m is never 1125)', () => {
    for (const locale of ['tr', 'en', 'ru', 'de', 'ar']) expect(parseDecimal(forLocale('1.125', locale), locale)).toEqual(dec(1125, 3))
  })
  it('leaves an unparsed value as typed', () => {
    expect(forLocale('abc', 'tr')).toBe('abc')
  })
})
