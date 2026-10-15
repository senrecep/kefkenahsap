import { publishedLocales } from './published'

export type LocaleState = 'live' | 'draft' | 'empty'
type Doc = Record<string, unknown> | null | undefined

const at = (doc: Doc, key: string, locale: string) => {
  const v = (doc?.[key] as Record<string, unknown> | null | undefined)?.[locale]
  return typeof v === 'string' ? v : null
}

/**
 * Per-locale state for the admin "Diller" panel, from `locale=all` reads of the latest draft and of the main doc.
 * "live" uses the site's own rule (publishedLocales: slug + title in the published doc), so it matches what visitors see.
 */
export function localeStates({ locales, titleKey, draft, published }: { locales: readonly string[]; titleKey: string; draft: Doc; published: Doc }) {
  const isPublished = published?._status === 'published'
  const live = publishedLocales(
    Object.fromEntries(locales.map((l) => [l, isPublished ? { slug: at(published, 'slug', l), title: at(published, titleKey, l) } : null])),
  )
  return locales.map((locale): { locale: string; state: LocaleState } => ({
    locale,
    state: live.includes(locale) ? 'live' : at(draft, titleKey, locale)?.trim() ? 'draft' : 'empty',
  }))
}
