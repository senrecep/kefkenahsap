import { Err } from 'tsentials/errors'
import { Result } from 'tsentials/result'

/** An exact decimal: n / 10^s. Kept as a scaled integer so volumes and money never pick up float noise (audit C, F). */
export type Dec = { n: bigint; s: number }

const required = () => Err.validation('Calc.Required', 'Required.')
const invalid = () => Err.validation('Calc.Invalid', 'Not a number.')

/** Arabic-Indic and Extended Arabic-Indic digits → ASCII, Arabic separators → ASCII, any space → ' '. */
export function normalizeDigits(input: string): string {
  return input
    .trim()
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, '.')
    .replace(/٬/g, ',')
    .replace(/[\s\u00a0\u202f]+/g, ' ')
}

const toDec = (sign: string, int: string, frac: string): Dec => ({ n: BigInt(`${sign}${int || '0'}${frac}`), s: frac.length })

const ambiguous = () => Err.validation('Calc.Ambiguous', 'A lone separator before three digits could be thousands or decimals.')
// "1.000", "20,500": a lone separator after 1–3 digits (not a leading 0) before exactly three digits reads as thousands
// in one language and as decimals in another. It is never guessed: the rules below do not depend on the page language,
// so a share link or a saved quote means the same on /tr and /en (#236 review).
const isAmbiguous = (int: string, frac: string | undefined) => /^[1-9]\d{0,2}$/.test(int) && frac?.length === 3

/**
 * A dimension, quantity or percentage as typed: `,` and `.` are both the decimal separator (bug B: the old app dropped
 * the comma and read "2,5" as 25), Arabic-Indic digits are accepted, grouping is not ("1.000,5" is rejected).
 */
export function parseDecimal(input: string): Result<Dec> {
  const s = normalizeDigits(input)
  if (!s) return Result.failure(required())
  const m = /^(-?)(\d*)(?:[.,](\d*))?$/.exec(s)
  if (!m || !`${m[2]}${m[3] ?? ''}`) return Result.failure(invalid())
  if (isAmbiguous(m[2]!, m[3])) return Result.failure(ambiguous())
  return Result.success(toDec(m[1]!, m[2]!, m[3] ?? ''))
}

const MAX_KURUS = 1e13

/**
 * A price to integer kuruş. Grouping is understood when it cannot be anything else: a repeated separator
 * ("1.234.567"), a space, or a different decimal separator after it ("20.000,50", "20,000.50"). A lone separator
 * before three digits ("20.000") is ambiguous; any other lone separator is the decimal point. At most two decimals,
 * counted as typed (trailing zeros included).
 */
export function parseMoney(input: string): Result<number> {
  const s = normalizeDigits(input)
  if (!s) return Result.failure(required())
  const negative = s.startsWith('-')
  const body = negative ? s.slice(1) : s
  let int: string
  let frac: string
  const grouped = /^([1-9]\d{0,2})((?:([., ])\d{3})(?:\3\d{3})*)(?:([.,])(\d+))?$/.exec(body)
  if (grouped) {
    const [, head, groups, sep, dot, decimals] = grouped
    if (dot && dot === sep) return Result.failure(invalid())
    if (!dot && sep !== ' ' && groups!.length === 4) return Result.failure(ambiguous())
    int = head! + groups!.replace(/\D/g, '')
    frac = decimals ?? ''
  } else {
    const plain = /^(\d*)(?:[.,](\d*))?$/.exec(body)
    if (!plain || !`${plain[1]}${plain[2] ?? ''}`) return Result.failure(invalid())
    int = plain[1]!
    frac = plain[2] ?? ''
  }
  if (negative) return Result.failure(Err.validation('Calc.Negative', 'Must not be negative.'))
  if (frac.length > 2) return Result.failure(Err.validation('Calc.TooManyDecimals', 'At most two decimals.'))
  const kurus = Number(int || '0') * 100 + Number(frac.padEnd(2, '0'))
  return Result.successIf(kurus <= MAX_KURUS, kurus, Err.validation('Calc.TooLarge', 'Too large.'))
}
