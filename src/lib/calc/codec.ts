import { Err } from 'tsentials/errors'
import { safeJsonParse } from 'tsentials/json'
import { Result } from 'tsentials/result'

import { normalizeDigits } from './number'
import { EXTRA_UNITS, LENGTH_UNITS, VAT_RATES, type ExtraInput, type QuoteInput, type TimberInput } from './quote'

export const MAX_ROWS = 50
const CAP = { num: 24, desc: 80, customer: 80, job: 120, note: 500 }
// v2: values as typed, read by language-independent rules (number.ts). v1 links were read with the page's rules and
// shared from the Turkish page, so they are migrated as Turkish (#236 review).
const VERSION = '2'
// Above the largest quote the form can hold (MAX_ROWS rows, every field at its cap, 3-byte UTF-8 characters: 55 021
// characters, codec.test.ts); a URL fragment of this size is fine in every browser.
const MAX_LINK = 80_000

const invalid = () => Err.validation('Calc.LinkInvalid', 'The shared calculation could not be read.')

// Positional JSON keeps the link short: [units, timber[[t,w,l,q,p]], waste, extras[[d,q,u,p]], [vatOn, rate], [customer, job, note]].
type Packed = [string[], string[][], string, string[][], [number, number], string[]]

const cut = (s: string, n: number) => s.slice(0, n)
const clamp = (q: QuoteInput): QuoteInput => ({
  ...q,
  timber: q.timber.slice(0, MAX_ROWS).map((r) => ({ t: cut(r.t, CAP.num), w: cut(r.w, CAP.num), l: cut(r.l, CAP.num), q: cut(r.q, CAP.num), p: cut(r.p, CAP.num) })),
  waste: cut(q.waste, CAP.num),
  extras: q.extras.slice(0, MAX_ROWS).map((r) => ({ d: cut(r.d, CAP.desc), q: cut(r.q, CAP.num), u: r.u, p: cut(r.p, CAP.num) })),
  meta: { customer: cut(q.meta.customer, CAP.customer), job: cut(q.meta.job, CAP.job), note: cut(q.meta.note, CAP.note) },
})

const toBase64Url = (s: string) => {
  let bin = ''
  for (const b of new TextEncoder().encode(s)) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const fromBase64Url = (s: string): Result<string> => {
  if (!/^[A-Za-z0-9_-]+$/.test(s) || s.length % 4 === 1) return Result.failure(invalid())
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return Result.success(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))))
}

/** The calculation as a versioned, URL-safe string ("1.<base64url JSON>") for the share link. */
export function encodeQuote(input: QuoteInput): string {
  const q = clamp(input)
  const packed: Packed = [
    q.units,
    q.timber.map((r) => [r.t, r.w, r.l, r.q, r.p]),
    q.waste,
    q.extras.map((r) => [r.d, r.q, r.u, r.p]),
    [q.vat.on ? 1 : 0, q.vat.rate],
    [q.meta.customer, q.meta.job, q.meta.note],
  ]
  return `${VERSION}.${toBase64Url(JSON.stringify(packed))}`
}

const str = (x: unknown): x is string => typeof x === 'string'
const strs = (x: unknown, n: number): x is string[] => Array.isArray(x) && x.length === n && x.every(str)
const rows = (x: unknown, n: number): x is string[][] => Array.isArray(x) && x.every((r) => strs(r, n))
const oneOf = <T extends string | number>(list: readonly T[], x: unknown): x is T => list.includes(x as T)

function unpack(x: unknown): Result<QuoteInput> {
  if (!Array.isArray(x) || x.length !== 6) return Result.failure(invalid())
  const [units, timber, waste, extras, vat, meta] = x as unknown[]
  const ok =
    strs(units, 3) &&
    units.every((u) => oneOf(LENGTH_UNITS, u)) &&
    rows(timber, 5) &&
    str(waste) &&
    rows(extras, 4) &&
    extras.every((r) => oneOf(EXTRA_UNITS, r[2])) &&
    Array.isArray(vat) &&
    vat.length === 2 &&
    oneOf([0, 1], vat[0]) &&
    oneOf(VAT_RATES, vat[1]) &&
    strs(meta, 3)
  if (!ok) return Result.failure(invalid())
  return Result.success(
    clamp({
      units: units as QuoteInput['units'],
      timber: timber.map(([t, w, l, q, p]): TimberInput => ({ t: t!, w: w!, l: l!, q: q!, p: p! })),
      waste,
      extras: extras.map(([d, q, u, p]): ExtraInput => ({ d: d!, q: q!, u: u as ExtraInput['u'], p: p! })),
      vat: { on: vat[0] === 1, rate: vat[1] },
      meta: { customer: meta[0]!, job: meta[1]!, note: meta[2]! },
    }),
  )
}

/** A shared link's calculation, or a failure (the page then starts with the empty form). */
export function decodeQuote(link: string): Result<QuoteInput> {
  if (link.length > MAX_LINK) return Result.failure(Err.validation('Calc.LinkTooLong', 'The shared calculation is too long.'))
  const dot = link.indexOf('.')
  if (dot < 1) return Result.failure(invalid())
  const version = link.slice(0, dot)
  if (version !== VERSION && version !== '1') return Result.failure(Err.validation('Calc.LinkVersion', 'Unknown calculation version.'))
  const r = Result.then(Result.then(fromBase64Url(link.slice(dot + 1)), (json) => Result.mapError(safeJsonParse(json), () => [invalid()])), unpack)
  return version === '1' ? Result.map(r, fromV1) : r
}

/** A v1 price, read as the Turkish page read it ("20.000" = 20 000; zeros after the decimals dropped), written unambiguously. */
export function v1Money(raw: string): string {
  const s = normalizeDigits(raw)
  const m = /^(\d{1,3}(?:[. ]\d{3})+)(?:,(\d*))?$/.exec(s) ?? /^(\d*)(?:[.,](\d*))?$/.exec(s)
  if (!m || !`${m[1]}${m[2] ?? ''}`) return raw
  const frac = (m[2] ?? '').replace(/0+$/, '')
  if (frac.length > 2) return raw
  const int = m[1]!.replace(/\D/g, '') || '0'
  return frac ? `${int},${frac}` : int
}
// A v1 dimension "1.000" was 1 (decimal point); one more zero keeps that value and is no longer ambiguous.
const v1Decimal = (raw: string) => (/^-?[1-9]\d{0,2}[.,]\d{3}$/.test(normalizeDigits(raw)) ? `${raw.trim()}0` : raw)
function fromV1(q: QuoteInput): QuoteInput {
  return {
    ...q,
    timber: q.timber.map((r) => ({ t: v1Decimal(r.t), w: v1Decimal(r.w), l: v1Decimal(r.l), q: v1Decimal(r.q), p: v1Money(r.p) })),
    waste: v1Decimal(q.waste),
    extras: q.extras.map((r) => ({ ...r, q: v1Decimal(r.q), p: v1Money(r.p) })),
  }
}

/** Whether anything has been typed: only then does the page put the calculation into its address. */
export const isFilled = (q: QuoteInput) =>
  [...q.timber.flatMap((r) => [r.t, r.w, r.l, r.q, r.p]), q.waste, ...q.extras.flatMap((r) => [r.d, r.q, r.p]), q.meta.customer, q.meta.job, q.meta.note].some((s) => s.trim() !== '')
