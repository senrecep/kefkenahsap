import { Err, ErrorMetadata, type AppError } from 'tsentials/errors'
import { Result } from 'tsentials/result'

import { parseDecimal, parseMoney, type Dec } from './number'

export const LENGTH_UNITS = ['mm', 'cm', 'm'] as const
export type LengthUnit = (typeof LENGTH_UNITS)[number]
export const EXTRA_UNITS = ['adet', 'kutu', 'litre', 'kg', 'm2', 'm3', 'metre', 'saat', 'goturu'] as const
export type ExtraUnit = (typeof EXTRA_UNITS)[number]
export const VAT_RATES = [20, 10, 1, 0] as const
export type VatRate = (typeof VAT_RATES)[number]

/** Everything is kept as typed (strings), so the share link and a reload give back exactly what was entered. */
export type TimberInput = { t: string; w: string; l: string; q: string; p: string }
export type ExtraInput = { d: string; q: string; u: ExtraUnit; p: string }
export type QuoteMeta = { customer: string; job: string; note: string }
export type QuoteInput = {
  units: [LengthUnit, LengthUnit, LengthUnit]
  timber: TimberInput[]
  waste: string
  extras: ExtraInput[]
  vat: { on: boolean; rate: VatRate }
  meta: QuoteMeta
}

/** The parsed values ride along so an export prints them formatted, never the raw input. */
export type TimberLine = { m3: number; kurus: number | null; suspiciousLength: boolean; dims: [number, number, number]; pieces: number; priceKurus: number | null }
export type ExtraLine = { kurus: number; qty: number; priceKurus: number }
export type Totals = {
  m3: number
  timberKurus: number
  wasteM3: number
  wasteKurus: number
  extrasKurus: number
  subtotalKurus: number
  vatKurus: number
  grandKurus: number
}
/** A row is `null` when blank (ignored), a failure when invalid (left out of the totals, `ok` false). */
export type Quote = { timber: Result<TimberLine | null>[]; extras: Result<ExtraLine | null>[]; totals: Totals; errors: AppError[]; ok: boolean }

export const emptyTimber = (): TimberInput => ({ t: '', w: '', l: '', q: '', p: '' })
export const emptyExtra = (): ExtraInput => ({ d: '', q: '', u: 'adet', p: '' })
export const emptyQuote = (): QuoteInput => ({
  units: ['cm', 'cm', 'cm'],
  timber: [emptyTimber()],
  waste: '',
  extras: [],
  vat: { on: true, rate: 20 },
  meta: { customer: '', job: '', note: '' },
})

const UNIT_SCALE: Record<LengthUnit, number> = { mm: 3, cm: 2, m: 0 } // value × 10^-scale = metres
const MAX_METRES = 20
const MAX_PIECES = 100_000
const MAX_EXTRA_QTY = 1_000_000
// 100 billion ₺ per line: a hundred lines (+ waste and KDV) stay far below Number.MAX_SAFE_INTEGER kuruş.
const MAX_LINE_KURUS = 10n ** 13n
const pow10 = (e: number) => 10n ** BigInt(e)

/** n / 10^s rounded half up to an integer (all amounts here are ≥ 0). */
export function roundHalfUp(n: bigint, s: number): number {
  const d = pow10(s)
  return Number((n * 2n + d) / (2n * d))
}

type Ctx = { section: string; row: number }
const fail = (ctx: Ctx, field: string, error: AppError) =>
  Err.validation(error.code, error.description, ErrorMetadata.fromRecord({ section: ctx.section, row: ctx.row, field }))
const v = (ctx: Ctx, field: string, code: string) => Err.validation(code, code, ErrorMetadata.fromRecord({ section: ctx.section, row: ctx.row, field }))
const blank = (...xs: string[]) => xs.every((x) => !x.trim())

/** A decimal field: parsed, > 0 and ≤ max (max given as n / 10^s units of the same scale). */
function positive(raw: string, ctx: Ctx, field: string, errors: AppError[], max?: Dec): Dec | null {
  const r = parseDecimal(raw)
  if (!r.ok) return errors.push(fail(ctx, field, r.errors[0]!)), null
  const d = r.value
  if (d.n <= 0n) return errors.push(v(ctx, field, 'Calc.NotPositive')), null
  if (max && d.n * pow10(max.s) > max.n * pow10(d.s)) return errors.push(v(ctx, field, 'Calc.TooLarge')), null
  return d
}

function money(raw: string, ctx: Ctx, errors: AppError[]): number | null {
  const r = parseMoney(raw)
  return r.ok ? r.value : (errors.push(fail(ctx, 'p', r.errors[0]!)), null)
}

function timberLine(input: TimberInput, units: QuoteInput['units'], row: number): Result<TimberLine | null> {
  if (blank(input.t, input.w, input.l, input.q, input.p)) return Result.success(null)
  const ctx = { section: 'timber', row }
  const errors: AppError[] = []
  const dims = (['t', 'w', 'l'] as const).map((f, i) => positive(input[f], ctx, f, errors, { n: BigInt(MAX_METRES) * pow10(UNIT_SCALE[units[i]!]), s: 0 }))
  const q = positive(input.q, ctx, 'q', errors, { n: BigInt(MAX_PIECES), s: 0 })
  // "2,0" is a whole count; "2,5" is not (bug G: the old app accepted it).
  const pieces = q && q.n % pow10(q.s) === 0n ? q.n / pow10(q.s) : null
  if (q && pieces === null) errors.push(v(ctx, 'q', 'Calc.NotInteger'))
  const price = input.p.trim() ? money(input.p, ctx, errors) : null
  if (errors.length) return Result.failureFrom(errors)
  const [t, w, l] = dims as Dec[]
  // V = N / 10^E m³, exact.
  const N = t!.n * w!.n * l!.n * pieces!
  const E = t!.s + w!.s + l!.s + UNIT_SCALE[units[0]] + UNIT_SCALE[units[1]] + UNIT_SCALE[units[2]]
  const lengthM = Number(l!.n) / 10 ** (l!.s + UNIT_SCALE[units[2]])
  const kurus = price === null ? null : N * BigInt(price)
  if (kurus !== null && kurus > MAX_LINE_KURUS * pow10(E)) return Result.failure(v(ctx, 'p', 'Calc.TooLarge'))
  return Result.success({
    m3: Number(N) / 10 ** E,
    kurus: kurus === null ? null : roundHalfUp(kurus, E),
    suspiciousLength: units[2] !== 'm' && lengthM < 0.3,
    dims: [num(t!), num(w!), num(l!)],
    pieces: Number(pieces),
    priceKurus: price,
  })
}

function extraLine(input: ExtraInput, row: number): Result<ExtraLine | null> {
  const lumpSum = input.u === 'goturu'
  if (blank(input.d, lumpSum ? '' : input.q, input.p)) return Result.success(null)
  const ctx = { section: 'extras', row }
  const errors: AppError[] = []
  if (!input.d.trim()) errors.push(v(ctx, 'd', 'Calc.Required'))
  // götürü (lump sum): the quantity is always 1.
  const q = lumpSum ? { n: 1n, s: 0 } : positive(input.q, ctx, 'q', errors, { n: BigInt(MAX_EXTRA_QTY), s: 0 })
  const price = money(input.p, ctx, errors)
  if (errors.length) return Result.failureFrom(errors)
  const kurus = q!.n * BigInt(price!)
  if (kurus > MAX_LINE_KURUS * pow10(q!.s)) return Result.failure(v(ctx, 'p', 'Calc.TooLarge'))
  return Result.success({ kurus: roundHalfUp(kurus, q!.s), qty: num(q!), priceKurus: price! })
}

function wastePercent(raw: string): Result<Dec | null> {
  if (!raw.trim()) return Result.success(null)
  const ctx = { section: 'waste', row: 0 }
  const r = parseDecimal(raw)
  if (!r.ok) return Result.failure(fail(ctx, 'waste', r.errors[0]!))
  const out = r.value.n < 0n || r.value.n > 100n * pow10(r.value.s)
  return out ? Result.failure(v(ctx, 'waste', 'Calc.OutOfRange')) : Result.success(r.value)
}

const num = (d: Dec) => Number(d.n) / 10 ** d.s
const value = <T>(r: Result<T | null>) => (Result.isSuccess(r) ? r.value : null)
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0)

/**
 * The whole quote, derived from the current input on every call (bug E: the old app watched a stale array). Money is
 * integer kuruş: each line is rounded once, the subtotal is the sum of the shown lines, and KDV is computed on that
 * rounded subtotal, so the lines on screen and in an export always add up (bug F). Entered prices exclude KDV. Nothing
 * here depends on the page language (#236 review): a link or saved quote means the same everywhere.
 */
export function computeQuote(input: QuoteInput): Quote {
  const timber = input.timber.map((r, i) => timberLine(r, input.units, i))
  const extras = input.extras.map((r, i) => extraLine(r, i))
  const waste = wastePercent(input.waste)
  const lines = timber.map(value).filter((l) => l !== null)
  const m3 = sum(lines.map((l) => l.m3))
  const timberKurus = sum(lines.map((l) => l.kurus ?? 0))
  const w = value(waste)
  const wasteKurus = w ? roundHalfUp(BigInt(timberKurus) * w.n, w.s + 2) : 0
  const wasteM3 = w ? (m3 * Number(w.n)) / 10 ** (w.s + 2) : 0
  const extrasKurus = sum(extras.map(value).map((l) => l?.kurus ?? 0))
  const subtotalKurus = timberKurus + wasteKurus + extrasKurus
  const vatKurus = input.vat.on ? roundHalfUp(BigInt(subtotalKurus) * BigInt(input.vat.rate), 2) : 0
  const errors = [...timber, ...extras, waste].flatMap((r: Result<unknown>) => (r.ok ? [] : r.errors))
  return {
    timber,
    extras,
    totals: { m3, timberKurus, wasteM3, wasteKurus, extrasKurus, subtotalKurus, vatKurus, grandKurus: subtotalKurus + vatKurus },
    errors,
    ok: errors.length === 0,
  }
}
