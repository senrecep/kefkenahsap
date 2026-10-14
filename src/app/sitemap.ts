import type { MetadataRoute } from 'next'

import { routing } from '@/i18n/routing'
import { getHomepage } from '@/lib/data/home'
import { CMS_PAGES, getPageTitles } from '@/lib/data/pages'
import { getSitemapDocs } from '@/lib/data/seo'
import { siteUrl } from '@/lib/seo/alternates'
import { cmsPagePaths, staticPaths } from '@/lib/seo/page-metadata'
import { sitemapEntries } from '@/lib/seo/sitemap'

export const dynamic = 'force-dynamic'

// Fixed, indexable routes (search is noindex and robots-disallowed, so it is not listed).
const STATIC = ['/', '/hizmetlerimiz', '/galeri', '/projeler', '/referanslar', '/hakkimizda', '/iletisim', '/kvkk', '/cerez-politikasi'] as const

const isCms = (href: string): href is keyof typeof CMS_PAGES => href in CMS_PAGES

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [docs, home] = await Promise.all([
    getSitemapDocs(),
    getHomepage(routing.defaultLocale).catch((err) => {
      console.error('sitemap: homepage lastmod unavailable', err)
      return null
    }),
  ])
  const fixed = await Promise.all(
    STATIC.map(async (href) => ({
      // About/legal: the same per-locale decision as the page's own hreflang/noindex.
      paths: isCms(href) ? cmsPagePaths(href, await getPageTitles(CMS_PAGES[href])) : staticPaths(href),
      lastModified: href === '/' ? home?.updatedAt : undefined,
    })),
  )
  return sitemapEntries([...fixed, ...docs], siteUrl())
}
