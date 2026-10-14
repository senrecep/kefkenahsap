import type { MetadataRoute } from 'next'

import { getPathname } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { getHomepage } from '@/lib/data/home'
import { getSitemapDocs } from '@/lib/data/seo'
import { siteUrl } from '@/lib/seo/alternates'
import { sitemapEntries } from '@/lib/seo/sitemap'

export const dynamic = 'force-dynamic'

// Fixed, indexable routes (search is noindex and robots-disallowed, so it is not listed).
const STATIC = ['/', '/hizmetlerimiz', '/galeri', '/projeler', '/referanslar', '/hakkimizda', '/iletisim', '/kvkk', '/cerez-politikasi'] as const

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [docs, home] = await Promise.all([getSitemapDocs(), getHomepage(routing.defaultLocale).catch(() => null)])
  const fixed = STATIC.map((href) => ({
    paths: Object.fromEntries(routing.locales.map((locale) => [locale, getPathname({ locale, href })])),
    lastModified: href === '/' ? home?.updatedAt : undefined,
  }))
  return sitemapEntries([...fixed, ...docs], siteUrl())
}
