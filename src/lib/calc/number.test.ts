import { describe, expect, it } from 'vitest'
import { Result } from 'tsentials/result'

import { parseDecimal, parseMoney } from './number'

const code = (r: Result<unknown>) => (Result.isFailure(r) ? r.errors[0]?.code : 'ok')
// Expected values are the decimals written as mantissa / 10^scale by hand.
const dec = (n: number, s: number) => Result.success({ n: BigInt(n), s })

describe('parseDecimal (dimensions, quantities): comma, dot and Arabic-Indic digits, no grouping', () => {
  it.each([
    ['2,5', dec(25, 1)], // bug B: the comma is a decimal separator, never dropped
    ['2.5', dec(25, 1)],
    ['٢٫٥', dec(25, 1)], // Arabic-Indic digits + Arabic decimal separator
    ['۲.۵', dec(25, 1)], // Extended (Persian) digits
    [' 400 ', dec(400, 0)],
    ['0,016', dec(16, 3)],
    ['.5', dec(5, 1)],
    ['5,', dec(5, 0)], // mid-typing
    ['-5', dec(-5, 0)], // parses; validation rejects it (bug G)
  ])('%s', (input, expected) => {
    expect(parseDecimal(input)).toEqual(expected)
  })

  it.each([
    ['', 'Calc.Required'],
    ['   ', 'Calc.Required'],
    ['abc', 'Calc.Invalid'],
    ['1.000,5', 'Calc.Invalid'], // two separators: a grouped number is not a dimension
    ['1 000', 'Calc.Invalid'],
    ['2,5,1', 'Calc.Invalid'],
    ['1e3', 'Calc.Invalid'],
  ])('rejects %j', (input, expected) => {
    expect(code(parseDecimal(input))).toBe(expected)
  })
})

describe('parseMoney: integer kuruş, the locale grouping separator is understood', () => {
  it.each([
    ['tr', '20000', 2_000_000],
    ['tr', '20.000', 2_000_000], // a Turkish price typed with a thousands dot is 20 000, not 20
    ['tr', '20.000,50', 2_000_050],
    ['tr', '1.234.567', 123_456_700],
    ['tr', '12345', 1_234_500],
    ['tr', '1,5', 150],
    ['tr', '1.5', 150], // one digit after the dot cannot be grouping
    ['tr', '0', 0],
    ['tr', '٢٠٫٥', 2050],
    ['de', '20.000', 2_000_000],
    ['en', '20,000', 2_000_000],
    ['en', '20,000.5', 2_000_050],
    ['en', '20.5', 2050],
    ['ru', '20 000', 2_000_000],
    ['ru', '20 000,5', 2_000_050], // no-break space, as ru formats it
    ['ar', '20,000', 2_000_000],
  ])('%s %s', (locale, input, kurus) => {
    expect(parseMoney(input, locale)).toEqual(Result.success(kurus))
  })

  it.each([
    ['tr', '', 'Calc.Required'],
    ['tr', '-1', 'Calc.Negative'],
    ['tr', '1,555', 'Calc.TooManyDecimals'],
    ['tr', '1.000,555', 'Calc.TooManyDecimals'],
    ['tr', '20.00.0', 'Calc.Invalid'],
    ['tr', 'abc', 'Calc.Invalid'],
  ])('rejects %s %j', (locale, input, expected) => {
    expect(code(parseMoney(input, locale))).toBe(expected)
  })

  it('reads a dot with two decimals as the decimal point in every locale', () => {
    expect(parseMoney('20.50', 'tr')).toEqual(Result.success(2050))
  })
})
