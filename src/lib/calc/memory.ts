import { safeJsonParse } from 'tsentials/json'
import { Result } from 'tsentials/result'

import { EXTRA_UNITS, type ExtraInput, type ExtraUnit } from './quote'

// Device-only lists (localStorage): saved calculations and the extra items a user keeps typing. Nothing leaves the device.
export const MAX_SAVED = 30
export const MAX_REMEMBERED = 50
const MAX_SUGGEST = 8

export type SavedEntry = { id: string; title: string; savedAt: string; link: string }
export type Remembered = { d: string; u: ExtraUnit; p: string; n: number; t: number }

const fold = (s: string) => s.trim().toLocaleLowerCase('tr')
const isStr = (x: unknown): x is string => typeof x === 'string'
const list = <T>(raw: string | null, ok: (x: Record<string, unknown>) => boolean): T[] => {
  const r = raw ? safeJsonParse(raw) : Result.success(null)
  const v = Result.isSuccess(r) ? r.value : null
  return Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object' && ok(x as Record<string, unknown>)) as T[]) : []
}

export const parseSaved = (raw: string | null) =>
  list<SavedEntry>(raw, (x) => isStr(x.id) && isStr(x.title) && isStr(x.savedAt) && isStr(x.link)).slice(0, MAX_SAVED)

export const parseRemembered = (raw: string | null) =>
  list<Remembered>(raw, (x) => isStr(x.d) && EXTRA_UNITS.includes(x.u as ExtraUnit) && isStr(x.p) && typeof x.n === 'number' && typeof x.t === 'number').slice(0, MAX_REMEMBERED)

/** Newest first; saving under an existing id replaces it. */
export const saveEntry = (saved: SavedEntry[], e: SavedEntry) => [e, ...saved.filter((s) => s.id !== e.id)].slice(0, MAX_SAVED)

/** Adds the described extra items (description, unit, last price), most recently used first. */
export function remember(mem: Remembered[], extras: ExtraInput[], now: Date): Remembered[] {
  let out = mem
  for (const x of extras) {
    const d = x.d.trim()
    if (!d) continue
    const prev = out.find((m) => fold(m.d) === fold(d))
    out = [{ d, u: x.u, p: x.p.trim(), n: (prev?.n ?? 0) + 1, t: now.getTime() }, ...out.filter((m) => m !== prev)]
  }
  return out.sort((a, b) => b.t - a.t).slice(0, MAX_REMEMBERED)
}

/** Remembered items whose description has a word starting with `typed`; an exact match is not suggested again. */
export function suggest(mem: Remembered[], typed: string): Remembered[] {
  const q = fold(typed)
  return mem.filter((m) => fold(m.d) !== q && (!q || fold(m.d).split(/\s+/).some((w) => w.startsWith(q)) || fold(m.d).startsWith(q))).slice(0, MAX_SUGGEST)
}
