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

const ambiguous = () => Err.validation('Calc.Ambiguous', 'Separators that contradict the page language.')
const esc = (c: string) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The page language's grouping and decimal characters (Latin digits, as the site formats them). */
function separators(locale: string) {
  const parts = new Intl.NumberFormat(locale, { numberingSystem: 'latn' }).formatToParts(12345.6)
  // ru groups with a no-break space; input spaces are normalised to ' '.
  const of = (type: string) => normalizeDigits(parts.find((p) => p.type === type)?.value ?? '') || ' '
  return { group: of('group'), decimal: of('decimal') }
}

/**
 * A number as typed on a page in `locale` (owner decision 2026-10-19): that language's grouping is read as thousands
 * when the groups have exactly three digits (tr "20.000" = 20 000, en "1,000.5"), its decimal separator as the decimal
 * point, a space always as grouping. Phone keypads: the other separator ("2.5" on tr, "2,5" on en) is a decimal when
 * three digits do not follow it. Input that contradicts the language ("1,000.5" on tr) is ambiguous, never guessed;
 * wrong group sizes are invalid. Arabic-Indic digits and Arabic separators are accepted everywhere.
 */
export function parseDecimal(input: string, locale: string): Result<Dec> {
  const s = normalizeDigits(input)
  if (!s) return Result.failure(required())
  const sign = s.startsWith('-') ? '-' : ''
  const body = sign ? s.slice(1) : s
  const { group, decimal } = separators(locale)
  const other = decimal === ',' ? '.' : ','
  const d = esc(decimal)
  const plain = new RegExp(`^(\\d*)(?:${d}(\\d*))?$`).exec(body)
  if (plain && `${plain[1]}${plain[2] ?? ''}`) return Result.success(toDec(sign, plain[1]!, plain[2] ?? ''))
  const g = group === ' ' ? ' ' : `[${esc(group)} ]`
  const grouped = new RegExp(`^([1-9]\\d{0,2})((?:${g}\\d{3})+)(?:${d}(\\d+))?$`).exec(body)
  if (grouped) return Result.success(toDec(sign, grouped[1]! + grouped[2]!.replace(/\D/g, ''), grouped[3] ?? ''))
  const lone = new RegExp(`^(\\d*)${esc(other)}(\\d+)$`).exec(body)
  // "2.5" / "0.500" on tr: the other separator cannot be grouping here, so it is the decimal point.
  if (lone && (lone[2]!.length !== 3 || !/[1-9]/.test(lone[1]!))) return Result.success(toDec(sign, lone[1]!, lone[2]!))
  if (lone || (body.includes('.') && body.includes(','))) return Result.failure(ambiguous())
  return Result.failure(invalid())
}

const MAX_KURUS = 1e13

/** A price as typed on a page in `locale` (rules of parseDecimal), to integer kuruş; at most two decimals as typed. */
export function parseMoney(input: string, locale: string): Result<number> {
  const r = parseDecimal(input, locale)
  if (!r.ok) return r
  const { n, s } = r.value
  if (n < 0n) return Result.failure(Err.validation('Calc.Negative', 'Must not be negative.'))
  if (s > 2) return Result.failure(Err.validation('Calc.TooManyDecimals', 'At most two decimals.'))
  const kurus = Number(n) * 10 ** (2 - s)
  return Result.successIf(kurus <= MAX_KURUS, kurus, Err.validation('Calc.TooLarge', 'Too large.'))
}

/** Canonical stored form of a parsed number: digits, "." as the decimal point, no grouping ("20000.5"). */
export const canonical = (d: Dec) => {
  const abs = (d.n < 0n ? -d.n : d.n).toString().padStart(d.s + 1, '0')
  return `${d.n < 0n ? '-' : ''}${d.s ? `${abs.slice(0, -d.s)}.${abs.slice(-d.s)}` : abs}`
}

/** A canonical value written for typing on a page in `locale` (its decimal separator, no grouping). */
export const forLocale = (value: string, locale: string) => (/^-?\d+(\.\d+)?$/.test(value) ? value.replace('.', separators(locale).decimal) : value)
