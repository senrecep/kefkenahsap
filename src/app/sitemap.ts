import type { MetadataRoute } from 'next'

import { routing } from '@/i18n/routing'
import { getGuides } from '@/lib/data/guides'
import { getHomepage } from '@/lib/data/home'
import { CMS_PAGES, getPageTitles } from '@/lib/data/pages'
import { getRegionSitemapDocs } from '@/lib/data/regions'
import { getSitemapDocs } from '@/lib/data/seo'
import { siteUrl } from '@/lib/seo/alternates'
import { cmsPagePaths, staticPaths } from '@/lib/seo/page-metadata'
import { sitemapEntries } from '@/lib/seo/sitemap'

export const dynamic = 'force-dynamic'

// Fixed, indexable routes (search is noindex and robots-disallowed, so it is not listed).
const STATIC = ['/', '/hizmetlerimiz', '/galeri', '/projeler', '/referanslar', '/hakkimizda', '/iletisim', '/kvkk', '/cerez-politikasi', '/rehber'] as const

// The guide index is noindex in a locale with no published guide yet (thin page), so it is listed only where it has some.
const guideIndexPaths = async () => {
  const all = staticPaths('/rehber')
  return Object.fromEntries(await Promise.all(routing.locales.map(async (l) => [l, (await getGuides(l)).length ? all[l] : null] as const)))
}

const isCms = (href: string): href is keyof typeof CMS_PAGES => href in CMS_PAGES

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [docs, regions, home] = await Promise.all([
    getSitemapDocs(),
    // Regions: only locales that pass the publish gate (≥3 projects + ≥250 words).
    getRegionSitemapDocs(),
    getHomepage(routing.defaultLocale).catch((err) => {
      console.error('sitemap: homepage lastmod unavailable', err)
      return null
    }),
  ])
  const fixed = await Promise.all(
    STATIC.map(async (href) => ({
      // About/legal: the same per-locale decision as the page's own hreflang/noindex.
      paths: isCms(href) ? cmsPagePaths(href, await getPageTitles(CMS_PAGES[href])) : href === '/rehber' ? await guideIndexPaths() : staticPaths(href),
      lastModified: href === '/' ? home?.updatedAt : undefined,
    })),
  )
  return sitemapEntries([...fixed, ...docs, ...regions], siteUrl())
}
