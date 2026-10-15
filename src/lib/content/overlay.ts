// #138: translation overlays for the locales beyond TR/EN. They live in seed/i18n/<locale>/<path>, where <path> mirrors
// the seed/ tree (content/categories/<slug>.json, media-meta/<cat>/<file>.json, …). The seed scripts fill only empty fields.
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { Err } from 'tsentials/errors'
import { safeJsonParse } from 'tsentials/json'
import { Maybe } from 'tsentials/maybe'
import { Result } from 'tsentials/result'

import { slugify } from '@/lib/slug'

import type { ProjectFix, TextFixes } from './schema'

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

/** Overlay slugs must be unique per locale within a collection; the failure names every clashing file. */
export function uniqueSlugs(entries: { locale: string; slug: string; file: string }[]): Result<void> {
  const byKey = new Map<string, typeof entries>()
  for (const e of entries) byKey.set(`${e.locale}/${e.slug}`, [...(byKey.get(`${e.locale}/${e.slug}`) ?? []), e])
  const clashes = [...byKey.entries()].filter(([, es]) => es.length > 1).map(([key, es]) => `${key}: ${es.map((e) => e.file).join(', ')}`)
  return clashes.length ? Result.failure(Err.conflict('Content.DuplicateSlug', `duplicate overlay slugs: ${clashes.join('; ')}`)) : Result.success(undefined)
}

/** The fixed text to write: only while the stored text is still exactly the seeded one (owner edits win). */
export const textFixUpdate = (current: string | null | undefined, change: { old: string; new: string }): Maybe<string> =>
  current === change.old && change.old !== change.new ? Maybe.some(change.new) : Maybe.none()

/** sentence-case.json (titles) and text-fixes.json (any field) as one field-level map; text-fixes wins on overlap. */
export const mergeTextFixes = (sentenceCase: Record<string, NonNullable<TextFixes[string]['title']>>, fixes: TextFixes): TextFixes => {
  const merged: TextFixes = Object.fromEntries(Object.entries(sentenceCase).map(([rel, title]) => [rel, { title }]))
  for (const [rel, fields] of Object.entries(fixes)) merged[rel] = { ...merged[rel], ...fields }
  return merged
}

/** #148: one locale's title/story of a project (story as plain text); each field only while still exactly the seeded `old`. */
export function projectFixPatch(current: { title?: string | null; story?: string | null }, fix: ProjectFix, locale: string): { title?: string; story?: string } {
  const patch: { title?: string; story?: string } = {}
  for (const field of ['title', 'story'] as const) {
    const change = fix[field]?.[locale]
    const next = change ? textFixUpdate(current[field], change) : Maybe.none<string>()
    if (Maybe.isSome(next)) patch[field] = next.value
  }
  return patch
}

/** #148: the year moved out of a title; written only while the project has none (an owner-entered year wins). */
export const projectYearFix = (current: number | null | undefined, fix: ProjectFix): Maybe<number> =>
  current == null && fix.year !== undefined ? Maybe.some(fix.year) : Maybe.none()

/**
 * #156: the slug a project locale should get, or none. Writes only where the stored slug is empty or exactly what the
 * pre-transliteration hook made of this title (the Latin bits of an Arabic title, e.g. a bare year), so an editor's
 * slug is never touched. `preferred` is a hand-written slug (the ar overlay); else the title's own slug.
 */
export function slugFix(current: { slug?: string | null; title?: string | null }, locale: string, preferred?: string): Maybe<string> {
  const title = current.title?.trim()
  if (!title) return Maybe.none()
  const slug = (s: string) => {
    const r = slugify(s, undefined, locale)
    return Result.isSuccess(r) ? r.value : ''
  }
  const stored = current.slug?.trim() ?? ''
  if (stored && stored !== slug(title.replace(/[؀-ۿ]/g, ' '))) return Maybe.none()
  const next = preferred ?? slug(title)
  return next && next !== stored ? Maybe.some(next) : Maybe.none()
}
