import { defineRouting } from 'next-intl/routing'

// Internal route folders use the Turkish names; other locales get translated public paths.
// CMS documents (categories, projects, images, guides) resolve their own localized slugs.
export const routing = defineRouting({
  locales: ['tr', 'en'],
  defaultLocale: 'tr',
  localePrefix: 'always',
  pathnames: {
    '/': '/',
    '/hizmetlerimiz': { tr: '/hizmetlerimiz', en: '/services' },
    '/galeri': { tr: '/galeri', en: '/gallery' },
    '/galeri/[slug]': { tr: '/galeri/[slug]', en: '/gallery/[slug]' },
    '/projeler': { tr: '/projeler', en: '/projects' },
    '/projeler/[slug]': { tr: '/projeler/[slug]', en: '/projects/[slug]' },
    '/rehber': { tr: '/rehber', en: '/guides' },
    '/rehber/[slug]': { tr: '/rehber/[slug]', en: '/guides/[slug]' },
    '/referanslar': { tr: '/referanslar', en: '/references' },
    '/hakkimizda': { tr: '/hakkimizda', en: '/about' },
    '/iletisim': { tr: '/iletisim', en: '/contact' },
    '/ara': { tr: '/ara', en: '/search' },
    '/kvkk': { tr: '/kvkk', en: '/privacy' },
    '/cerez-politikasi': { tr: '/cerez-politikasi', en: '/cookies' },
    '/[category]': '/[category]',
  },
})

export type Locale = (typeof routing.locales)[number]

const RTL_LOCALES = new Set(['ar'])
export const localeDir = (locale: string): 'rtl' | 'ltr' => (RTL_LOCALES.has(locale) ? 'rtl' : 'ltr')
