import { Err } from 'tsentials/errors'
import { safeJsonParse } from 'tsentials/json'
import { Result } from 'tsentials/result'

import { EXTRA_UNITS, LENGTH_UNITS, VAT_RATES, type ExtraInput, type QuoteInput, type TimberInput } from './quote'

export const MAX_ROWS = 50
const MAX_LINK = 12_000
const CAP = { num: 24, desc: 80, customer: 80, job: 120, note: 500 }
const VERSION = '1'

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
  if (link.slice(0, dot) !== VERSION) return Result.failure(Err.validation('Calc.LinkVersion', 'Unknown calculation version.'))
  return Result.then(Result.then(fromBase64Url(link.slice(dot + 1)), (json) => Result.mapError(safeJsonParse(json), () => [invalid()])), unpack)
}

/** Whether anything has been typed: only then does the page put the calculation into its address. */
export const isFilled = (q: QuoteInput) =>
  [...q.timber.flatMap((r) => Object.values(r)), q.waste, ...q.extras.flatMap((r) => [r.d, r.q, r.p]), ...Object.values(q.meta)].some((s) => s.trim() !== '')
