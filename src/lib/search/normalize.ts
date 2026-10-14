import { Err } from 'tsentials/errors'
import { Result } from 'tsentials/result'

export const MIN_QUERY = 2
export const MAX_QUERY = 100

/**
 * Turkish-aware folding to plain ASCII-ish lowercase. Must stay in step with the SQL
 * `search_norm()` function (migration `search`): İ/I/ı → i first, then strip diacritics.
 */
export function foldText(input: string): string {
  return input
    .normalize('NFC')
    .replace(/[İIı]/g, 'i')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[ßæœøłđ]/g, (c) => LETTERS[c]!)
}

// Letters without a combining-mark decomposition that Postgres unaccent still folds.
const LETTERS: Record<string, string> = { ß: 'ss', æ: 'ae', œ: 'oe', ø: 'o', ł: 'l', đ: 'd' }

export type NormalizedQuery = { text: string; tokens: string[] }

/** User query → folded tokens of [a-z0-9] only, so they are safe for tsquery and trigram matching. */
export function normalizeQuery(raw: string): Result<NormalizedQuery> {
  if (raw.length > MAX_QUERY) return Result.failure(Err.validation('Search.QueryTooLong', `Arama en fazla ${MAX_QUERY} karakter olabilir.`))
  const tokens = foldText(raw)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
  const text = tokens.join(' ')
  if (text.length < MIN_QUERY) return Result.failure(Err.validation('Search.QueryTooShort', `En az ${MIN_QUERY} karakter yazın.`))
  return Result.success({ text, tokens })
}

/** Prefix match on every token (autocomplete-friendly): `deck:* & iroko:*`. Tokens must come from normalizeQuery. */
export const prefixTsQuery = (tokens: string[]) => tokens.map((t) => `${t}:*`).join(' & ')
