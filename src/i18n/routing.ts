import { defineRouting } from 'next-intl/routing'

// Internal route folders use the Turkish names; other locales get translated public paths (ar reuses the English ones).
// CMS documents (categories, projects, images, guides) resolve their own localized slugs.
export const routing = defineRouting({
  locales: ['tr', 'en', 'ru', 'de', 'ar'],
  defaultLocale: 'tr',
  localePrefix: 'always',
  pathnames: {
    '/': '/',
    '/hizmetlerimiz': { tr: '/hizmetlerimiz', en: '/services', ru: '/uslugi', de: '/leistungen', ar: '/services' },
    '/galeri': { tr: '/galeri', en: '/gallery', ru: '/galereya', de: '/galerie', ar: '/gallery' },
    '/galeri/[slug]': { tr: '/galeri/[slug]', en: '/gallery/[slug]', ru: '/galereya/[slug]', de: '/galerie/[slug]', ar: '/gallery/[slug]' },
    '/projeler': { tr: '/projeler', en: '/projects', ru: '/proekty', de: '/projekte', ar: '/projects' },
    '/projeler/[slug]': { tr: '/projeler/[slug]', en: '/projects/[slug]', ru: '/proekty/[slug]', de: '/projekte/[slug]', ar: '/projects/[slug]' },
    '/rehber': { tr: '/rehber', en: '/guides', ru: '/stati', de: '/ratgeber', ar: '/guides' },
    '/rehber/[slug]': { tr: '/rehber/[slug]', en: '/guides/[slug]', ru: '/stati/[slug]', de: '/ratgeber/[slug]', ar: '/guides/[slug]' },
    '/bolgeler/[slug]': { tr: '/bolgeler/[slug]', en: '/areas/[slug]', ru: '/regiony/[slug]', de: '/regionen/[slug]', ar: '/areas/[slug]' },
    '/referanslar': { tr: '/referanslar', en: '/references', ru: '/klienty', de: '/referenzen', ar: '/references' },
    '/hakkimizda': { tr: '/hakkimizda', en: '/about', ru: '/o-nas', de: '/ueber-uns', ar: '/about' },
    '/iletisim': { tr: '/iletisim', en: '/contact', ru: '/kontakty', de: '/kontakt', ar: '/contact' },
    '/ara': { tr: '/ara', en: '/search', ru: '/poisk', de: '/suche', ar: '/search' },
    '/kvkk': { tr: '/kvkk', en: '/privacy', ru: '/konfidentsialnost', de: '/datenschutz', ar: '/privacy' },
    '/cerez-politikasi': { tr: '/cerez-politikasi', en: '/cookies', ru: '/cookies', de: '/cookies', ar: '/cookies' },
    '/[category]': '/[category]',
  },
})

export type Locale = (typeof routing.locales)[number]

const RTL_LOCALES = new Set(['ar'])
export const localeDir = (locale: string): 'rtl' | 'ltr' => (RTL_LOCALES.has(locale) ? 'rtl' : 'ltr')
