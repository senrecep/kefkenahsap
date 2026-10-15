import type { Locale } from './routing'

/** Turkish names of the content languages, for the (Turkish-only) admin's own panels and messages. */
export const localeNameTr: Record<Locale, string> = { tr: 'Türkçe', en: 'İngilizce', ru: 'Rusça', de: 'Almanca', ar: 'Arapça' }

export const localeName = (code: string) => localeNameTr[code as Locale] ?? code.toUpperCase()
