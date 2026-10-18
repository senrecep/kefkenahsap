import { publishedLocales } from './published'

export type LocaleState = 'live' | 'changed' | 'draft' | 'empty'
type Doc = Record<string, unknown> | null | undefined

const at = (doc: Doc, key: string, locale: string) => {
  const v = (doc?.[key] as Record<string, unknown> | null | undefined)?.[locale]
  return typeof v === 'string' ? v : null
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const META = new Set(['id', 'createdAt', 'updatedAt', '_status'])

/** Same value, with missing and null treated alike. */
const same = (a: unknown, b: unknown): boolean => {
  if (a == null || b == null) return (a ?? null) === (b ?? null)
  if (Array.isArray(a) || Array.isArray(b))
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((x, i) => same(x, b[i]))
    )
  if (isObject(a) && isObject(b))
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].every((k) => same(a[k], b[k]))
  return a === b
}

/**
 * Does any per-language value of `locale` differ between two `locale=all` reads? A per-language field reads as an object
 * keyed only by locale codes; everything else is shared structure to walk through (shared fields themselves don't count).
 * shortcut: a shared object whose keys are all locale codes would be misread as per-language; none exists in the
 * collections that show the panel.
 */
function localeChanged(
  a: unknown,
  b: unknown,
  locale: string,
  locales: readonly string[],
): boolean {
  const keys = [
    ...new Set([...(isObject(a) ? Object.keys(a) : []), ...(isObject(b) ? Object.keys(b) : [])]),
  ]
  if (keys.length && keys.every((k) => locales.includes(k)))
    return !same((a as Record<string, unknown>)?.[locale], (b as Record<string, unknown>)?.[locale])
  if (Array.isArray(a) || Array.isArray(b)) {
    const n = Math.max(Array.isArray(a) ? a.length : 0, Array.isArray(b) ? b.length : 0)
    return Array.from({ length: n }).some((_, i) =>
      localeChanged((a as unknown[])?.[i], (b as unknown[])?.[i], locale, locales),
    )
  }
  return keys.some(
    (k) =>
      !META.has(k) &&
      localeChanged(
        (a as Record<string, unknown>)?.[k],
        (b as Record<string, unknown>)?.[k],
        locale,
        locales,
      ),
  )
}

/**
 * Per-locale state for the admin "Diller" panel, from `locale=all` reads of the latest draft and of the main doc.
 * "live" uses the site's own rule (publishedLocales: slug + title in the published doc), so it matches what visitors see;
 * "changed" is live with a newer draft whose own text differs.
 */
export function localeStates({
  locales,
  titleKey,
  draft,
  published,
}: {
  locales: readonly string[]
  titleKey: string
  draft: Doc
  published: Doc
}) {
  const isPublished = published?._status === 'published'
  const live = publishedLocales(
    Object.fromEntries(
      locales.map((l) => [
        l,
        isPublished ? { slug: at(published, 'slug', l), title: at(published, titleKey, l) } : null,
      ]),
    ),
  )
  return locales.map((locale): { locale: string; state: LocaleState } => ({
    locale,
    state: live.includes(locale)
      ? localeChanged(draft, published, locale, locales)
        ? 'changed'
        : 'live'
      : at(draft, titleKey, locale)?.trim()
        ? 'draft'
        : 'empty',
  }))
}
