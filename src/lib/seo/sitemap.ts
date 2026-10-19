import type { MetadataRoute } from 'next'

import { routing, type Locale } from '@/i18n/routing'

import { buildAlternates } from './alternates'

export type SitemapDoc = {
  /** Path per locale; null/undefined where the translation is not live (that URL is noindex, so not listed). */
  paths: Record<string, string | null | undefined>
  lastModified?: string | null
  images?: string[]
}

/**
 * PLAN §7 Teknik 8: only indexable URLs, each with its language alternates; images use the image-sitemap extension.
 * `locale`: only that locale's URLs (one child sitemap), each still listing every live alternate.
 */
export function sitemapEntries(docs: SitemapDoc[], site: string, locale?: string): MetadataRoute.Sitemap {
  return docs.flatMap((d) => {
    const { languages } = buildAlternates({ current: '', paths: d.paths, site })
    return Object.keys(d.paths)
      .filter((l) => d.paths[l] && (!locale || l === locale))
      .map((l) => ({
        url: languages[l]!,
        ...(d.lastModified ? { lastModified: d.lastModified } : {}),
        alternates: { languages },
        ...(d.images?.length ? { images: d.images } : {}),
      }))
  })
}

/** Child sitemaps: pages (fixed routes, services, projects, guides, regions) and gallery photos, one per locale. */
export const SITEMAP_KINDS = ['pages', 'photos'] as const
export type SitemapKind = (typeof SITEMAP_KINDS)[number]

export const sitemapFile = (locale: Locale, kind: SitemapKind) => `${locale}-${kind}.xml`

export function parseSitemapFile(file: string): { locale: Locale; kind: SitemapKind } | null {
  const m = /^([a-z]{2})-([a-z]+)\.xml$/.exec(file)
  const locale = routing.locales.find((l) => l === m?.[1])
  const kind = SITEMAP_KINDS.find((k) => k === m?.[2])
  return locale && kind ? { locale, kind } : null
}

/**
 * Shared caches (Cloudflare) keep a child for an hour and serve it stale while refreshing; browsers always revalidate.
 * A Payload save refreshes the data behind it at once (cache tags); the edge copy catches up within the hour.
 */
export const SITEMAP_CACHE_CONTROL = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
const XML = '<?xml version="1.0" encoding="UTF-8"?>\n'

/** The same markup Next's metadata sitemap route wrote (one <url> per entry), so crawlers see no difference. */
export function urlsetXml(entries: MetadataRoute.Sitemap): string {
  const urls = entries.map((e) => {
    const links = Object.entries(e.alternates?.languages ?? {}).map(([l, href]) => `<xhtml:link rel="alternate" hreflang="${esc(l)}" href="${esc(String(href))}" />\n`)
    const images = (e.images ?? []).map((src) => `<image:image>\n<image:loc>${esc(src)}</image:loc>\n</image:image>\n`)
    const lastmod = e.lastModified ? `<lastmod>${esc(String(e.lastModified))}</lastmod>\n` : ''
    return `<url>\n<loc>${esc(e.url)}</loc>\n${links.join('')}${images.join('')}${lastmod}</url>\n`
  })
  return `${XML}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('')}</urlset>\n`
}

export function sitemapIndexXml(locs: string[]): string {
  return `${XML}<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${locs.map((l) => `<sitemap>\n<loc>${esc(l)}</loc>\n</sitemap>\n`).join('')}</sitemapindex>\n`
}
