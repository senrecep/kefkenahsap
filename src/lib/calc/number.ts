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
    .replace(/[\s  ]+/g, ' ')
}

const toDec = (sign: string, int: string, frac: string): Dec => ({ n: BigInt(`${sign}${int || '0'}${frac}`), s: frac.length })

/**
 * A dimension, quantity or percentage as typed: `,` and `.` are both the decimal separator (bug B: the old app dropped
 * the comma and read "2,5" as 25), Arabic-Indic digits are accepted, grouping is not ("1.000,5" is rejected).
 */
export function parseDecimal(input: string): Result<Dec> {
  const s = normalizeDigits(input)
  if (!s) return Result.failure(required())
  const m = /^(-?)(\d*)(?:[.,](\d*))?$/.exec(s)
  if (!m || !`${m[2]}${m[3] ?? ''}`) return Result.failure(invalid())
  return Result.success(toDec(m[1]!, m[2]!, m[3] ?? ''))
}

const separators = (locale: string) => {
  const parts = new Intl.NumberFormat(locale, { numberingSystem: 'latn' }).formatToParts(12345.6)
  // ru groups with a no-break space; input spaces are normalised to ' '.
  const of = (type: string) => normalizeDigits(parts.find((p) => p.type === type)?.value ?? '') || ' '
  return { group: of('group'), decimal: of('decimal') }
}
const esc = (c: string) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const MAX_KURUS = 1e13

/**
 * A price as typed in `locale`, to integer kuruş. The locale's grouping is understood, so a Turkish "20.000" is
 * 20 000 ₺, not 20 ₺ (bug B again, a 1000× error). A separator not followed by exactly three-digit groups is the
 * decimal point, whichever character it is. More than two decimals (other than trailing zeros) is an error.
 */
export function parseMoney(input: string, locale: string): Result<number> {
  const s = normalizeDigits(input)
  if (!s) return Result.failure(required())
  const negative = s.startsWith('-')
  const body = negative ? s.slice(1) : s
  const { group, decimal } = separators(locale)
  const grouped = new RegExp(`^(\\d{1,3}(?:(?:${esc(group)}| )\\d{3})+)(?:${esc(decimal)}(\\d*))?$`).exec(body)
  const plain = /^(\d*)(?:[.,](\d*))?$/.exec(body)
  const m = grouped ?? plain
  if (!m || !`${m[1]}${m[2] ?? ''}`) return Result.failure(invalid())
  if (negative) return Result.failure(Err.validation('Calc.Negative', 'Must not be negative.'))
  const int = m[1]!.replace(/\D/g, '')
  const frac = (m[2] ?? '').replace(/0+$/, '')
  if (frac.length > 2) return Result.failure(Err.validation('Calc.TooManyDecimals', 'At most two decimals.'))
  const kurus = Number(int || '0') * 100 + Number(frac.padEnd(2, '0'))
  return Result.successIf(kurus <= MAX_KURUS, kurus, Err.validation('Calc.TooLarge', 'Too large.'))
}
