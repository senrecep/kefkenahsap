// #138: translation overlays for the locales beyond TR/EN. They live in seed/i18n/<locale>/<path>, where <path> mirrors
// the seed/ tree (content/categories/<slug>.json, media-meta/<cat>/<file>.json, …). The seed scripts fill only empty fields.
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { Err } from 'tsentials/errors'
import { safeJsonParse } from 'tsentials/json'
import { Maybe } from 'tsentials/maybe'
import { Result } from 'tsentials/result'

/** TR and EN come from the committed seed itself; every other configured locale comes from an overlay. */
export const overlayLocales = <L extends string>(codes: readonly L[]): L[] => codes.filter((c) => c !== 'tr' && c !== 'en')

/** One overlay file: none when it (or the whole locale) is missing, a failure when it is there but invalid. */
export function readOverlay<T>(seedDir: string, locale: string, rel: string, parse: (json: string) => Result<T>): Result<Maybe<T>> {
  const file = path.join(seedDir, 'i18n', locale, rel)
  if (!existsSync(file)) return Result.success(Maybe.none())
  const r = parse(readFileSync(file, 'utf8'))
  return r.ok ? Result.success(Maybe.some(r.value)) : Result.failure(Err.validation('Content.InvalidOverlay', `${locale}/${rel}: ${r.errors.map((e) => e.description).join('; ')}`))
}

/**
 * The Media seedKey of a meta file (path under seed/), the way the loaders key it: seed.ts uses "<category>/<file>",
 * archive.ts uses "archive/<source>" with the source taken from the committed archive meta.
 */
export function mediaSeedKey(seedDir: string, rel: string): Result<string> {
  const [tree, category, file] = rel.split('/')
  if (tree === 'media-meta' && category && file?.endsWith('.json')) return Result.success(`${category}/${file.slice(0, -'.json'.length)}`)
  if (tree !== 'media-meta-archive') return Result.failure(Err.validation('Content.UnknownMediaMeta', `${rel}: not under media-meta/ or media-meta-archive/`))
  const committed = path.join(seedDir, rel)
  if (!existsSync(committed)) return Result.failure(Err.notFound('Content.UnknownMediaMeta', `${rel}: no committed archive meta`))
  const json = safeJsonParse(readFileSync(committed, 'utf8'))
  if (!json.ok) return json
  const source = (json.value as { source?: unknown }).source
  return typeof source === 'string' && source ? Result.success(`archive/${source}`) : Result.failure(Err.validation('Content.UnknownMediaMeta', `${rel}: no source`))
}

/** The sentence-case title to write: only while the stored title is still exactly the seeded one (owner edits win). */
export const sentenceCaseUpdate = (current: string | null | undefined, change: { old: string; new: string }): Maybe<string> =>
  current === change.old && change.old !== change.new ? Maybe.some(change.new) : Maybe.none()
