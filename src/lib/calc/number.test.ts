import { describe, expect, it } from 'vitest'
import { Result } from 'tsentials/result'

import { parseDecimal, parseMoney } from './number'

const code = (r: Result<unknown>) => (Result.isFailure(r) ? r.errors[0]?.code : 'ok')
// Expected values are the decimals written as mantissa / 10^scale by hand.
const dec = (n: number, s: number) => Result.success({ n: BigInt(n), s })

// The rules never depend on the page language: a link or a saved quote reads the same on /tr and on /en (#236 review).
describe('parseDecimal (dimensions, quantities, waste): comma or dot decimal, Arabic-Indic digits, no grouping', () => {
  it.each([
    ['2,5', dec(25, 1)], // bug B: the comma is a decimal separator, never dropped
    ['2.5', dec(25, 1)],
    ['٢٫٥', dec(25, 1)], // Arabic-Indic digits + Arabic decimal separator
    ['۲.۵', dec(25, 1)], // Extended (Persian) digits
    [' 400 ', dec(400, 0)],
    ['0,016', dec(16, 3)], // a leading 0 cannot be a thousands group
    ['1,0000', dec(10_000, 4)],
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
    ['1.000', 'Calc.Ambiguous'], // one thousand pieces, or 1? (#236 review: was read as 1)
    ['2.400', 'Calc.Ambiguous'], // 2400 mm, or 2,4? (was 2,4)
    ['1,250', 'Calc.Ambiguous'],
    ['-1.000', 'Calc.Ambiguous'],
    ['1.000,5', 'Calc.Invalid'], // grouped: not a dimension
    ['1 000', 'Calc.Invalid'],
    ['2,5,1', 'Calc.Invalid'],
    ['1e3', 'Calc.Invalid'],
  ])('rejects %j', (input, expected) => {
    expect(code(parseDecimal(input))).toBe(expected)
  })
})

describe('parseMoney: integer kuruş, the same in every language', () => {
  it.each([
    ['20000', 2_000_000],
    ['20.000,50', 2_000_050], // a grouping and a different decimal separator: unambiguous
    ['20,000.50', 2_000_050],
    ['20.000,0', 2_000_000],
    ['1.234.567', 123_456_700], // two groups: only thousands can repeat
    ['1,234,567', 123_456_700],
    ['20 000', 2_000_000], // a space is never a decimal separator
    ['20\u00a0000,5', 2_000_050], // no-break space, as ru formats it
    ['12345', 1_234_500],
    ['1,5', 150],
    ['1.5', 150],
    ['20.50', 2050],
    ['0.50', 50],
    ['.5', 50],
    ['0', 0],
    ['٢٠٫٥', 2050],
    ['١٬٢٣٤٫٥', 123_450],
  ])('%j → %i kuruş', (input, kurus) => {
    expect(parseMoney(input)).toEqual(Result.success(kurus))
  })

  it.each([
    ['', 'Calc.Required'],
    ['-1', 'Calc.Negative'],
    ['20.000', 'Calc.Ambiguous'], // 20 000 ₺ in tr, 20 ₺ in en: never guessed (#236 review)
    ['20,000', 'Calc.Ambiguous'],
    ['20,500', 'Calc.Ambiguous'], // was 20,50 after its zeros were stripped
    ['1.234', 'Calc.Ambiguous'],
    ['1,5000', 'Calc.TooManyDecimals'], // decimals counted before any zero is dropped
    ['1.000,555', 'Calc.TooManyDecimals'],
    ['0.500', 'Calc.TooManyDecimals'], // a leading 0 is no thousands group: three decimals
    ['1.000.00', 'Calc.Invalid'],
    ['1.2.3', 'Calc.Invalid'],
    ['20.00.0', 'Calc.Invalid'],
    ['1.234,567.8', 'Calc.Invalid'],
    ['abc', 'Calc.Invalid'],
  ])('rejects %j', (input, expected) => {
    expect(code(parseMoney(input))).toBe(expected)
  })
})
