import { defineRouting } from 'next-intl/routing'

// Internal route folders use the Turkish names; other locales get translated public paths.
// CMS documents (categories, projects, images, guides) resolve their own localized slugs.
export const routing = defineRouting({
  locales: ['tr', 'en', 'ru', 'de'],
  defaultLocale: 'tr',
  localePrefix: 'always',
  pathnames: {
    '/': '/',
    '/hizmetlerimiz': { tr: '/hizmetlerimiz', en: '/services', ru: '/uslugi', de: '/leistungen' },
    '/galeri': { tr: '/galeri', en: '/gallery', ru: '/galereya', de: '/galerie' },
    '/galeri/[slug]': { tr: '/galeri/[slug]', en: '/gallery/[slug]', ru: '/galereya/[slug]', de: '/galerie/[slug]' },
    '/projeler': { tr: '/projeler', en: '/projects', ru: '/proekty', de: '/projekte' },
    '/projeler/[slug]': { tr: '/projeler/[slug]', en: '/projects/[slug]', ru: '/proekty/[slug]', de: '/projekte/[slug]' },
    '/rehber': { tr: '/rehber', en: '/guides', ru: '/stati', de: '/ratgeber' },
    '/rehber/[slug]': { tr: '/rehber/[slug]', en: '/guides/[slug]', ru: '/stati/[slug]', de: '/ratgeber/[slug]' },
    '/bolgeler/[slug]': { tr: '/bolgeler/[slug]', en: '/areas/[slug]', ru: '/regiony/[slug]', de: '/regionen/[slug]' },
    '/referanslar': { tr: '/referanslar', en: '/references', ru: '/klienty', de: '/referenzen' },
    '/hakkimizda': { tr: '/hakkimizda', en: '/about', ru: '/o-nas', de: '/ueber-uns' },
    '/iletisim': { tr: '/iletisim', en: '/contact', ru: '/kontakty', de: '/kontakt' },
    '/ara': { tr: '/ara', en: '/search', ru: '/poisk', de: '/suche' },
    '/kvkk': { tr: '/kvkk', en: '/privacy', ru: '/konfidentsialnost', de: '/datenschutz' },
    '/cerez-politikasi': { tr: '/cerez-politikasi', en: '/cookies', ru: '/cookies', de: '/cookies' },
    '/[category]': '/[category]',
  },
})

export type Locale = (typeof routing.locales)[number]

const RTL_LOCALES = new Set(['ar'])
export const localeDir = (locale: string): 'rtl' | 'ltr' => (RTL_LOCALES.has(locale) ? 'rtl' : 'ltr')
