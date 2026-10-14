import { defineRouting } from 'next-intl/routing'

// Fixed (non-CMS) pages get localized pathnames here; CMS documents resolve their own localized slugs.
export const routing = defineRouting({
  locales: ['tr', 'en'],
  defaultLocale: 'tr',
  localePrefix: 'always',
  pathnames: {
    '/': '/',
  },
})

export type Locale = (typeof routing.locales)[number]

const RTL_LOCALES = new Set(['ar'])
export const localeDir = (locale: string): 'rtl' | 'ltr' => (RTL_LOCALES.has(locale) ? 'rtl' : 'ltr')
