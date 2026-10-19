import { routing } from '@/i18n/routing'
import { getContentLocales } from '@/lib/data/categories'
import { getHomepage } from '@/lib/data/home'
import { CMS_PAGES, getPageTitles } from '@/lib/data/pages'
import { getRegionSitemapDocs } from '@/lib/data/regions'
import { getSitemapPageDocs, getSitemapPhotoDocs } from '@/lib/data/seo'
import { siteUrl } from '@/lib/seo/alternates'
import { cmsPagePaths, staticPaths } from '@/lib/seo/page-metadata'
import { sitemapFile, SITEMAP_KINDS, type SitemapDoc, type SitemapKind } from '@/lib/seo/sitemap'

// Fixed, indexable routes (search is noindex and robots-disallowed, so it is not listed).
const STATIC = ['/', '/hizmetlerimiz', '/galeri', '/projeler', '/referanslar', '/hakkimizda', '/iletisim', '/kvkk', '/cerez-politikasi', '/rehber', '/malzeme-hesaplayici'] as const

// The guide index is noindex in a locale with no published guide yet (thin page), so it is listed only where it has some.
// Read from the sitemap's own guide list (live = slug + title, as getGuides lists them): getGuides also builds every
// card's photo, 5.8 s cold for five locales.
const guideIndexPaths = async (guides: SitemapDoc[]) => {
  const all = await staticPaths('/rehber')
  return Object.fromEntries(routing.locales.map((l) => [l, all[l] && guides.some((g) => g.paths[l]) ? all[l] : null]))
}

const isCms = (href: string): href is keyof typeof CMS_PAGES => href in CMS_PAGES

async function pageDocs(): Promise<SitemapDoc[]> {
  // Every fixed route asks for the content locales; fill that cache once first: unstable_cache does not merge
  // concurrent misses, and eleven of them (with the old service-tile query) were 42 of the old 45 s cold.
  await getContentLocales()
  const [{ services, projects, guides }, regions, home] = await Promise.all([
    getSitemapPageDocs(),
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
      paths: isCms(href) ? await cmsPagePaths(href, await getPageTitles(CMS_PAGES[href])) : href === '/rehber' ? await guideIndexPaths(guides) : await staticPaths(href),
      lastModified: href === '/' ? home?.updatedAt : undefined,
    })),
  )
  return [...fixed, ...services, ...projects, ...guides, ...regions]
}

/** The documents behind one kind of child sitemap; every loader is tag-cached, so a Payload save refreshes it. */
export const sitemapDocs = (kind: SitemapKind): Promise<SitemapDoc[]> => (kind === 'pages' ? pageDocs() : getSitemapPhotoDocs())

/** Child sitemaps that have at least one URL: the sitemap index lists only these. */
export async function sitemapChildren(): Promise<string[]> {
  const site = siteUrl()
  const kinds = await Promise.all(SITEMAP_KINDS.map(async (kind) => ({ kind, docs: await sitemapDocs(kind) })))
  return kinds.flatMap(({ kind, docs }) =>
    routing.locales.filter((l) => docs.some((d) => d.paths[l])).map((l) => `${site.replace(/\/$/, '')}/sitemaps/${sitemapFile(l, kind)}`),
  )
}
