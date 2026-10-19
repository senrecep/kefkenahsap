import { sitemapChildren } from '@/lib/data/sitemap'
import { SITEMAP_CACHE_CONTROL, sitemapIndexXml } from '@/lib/seo/sitemap'

// Reads CMS data per request (no DB at build time); the data loaders are tag-cached and the edge keeps the response.
export const dynamic = 'force-dynamic'

/** Sitemap index (robots.txt points here): one child per locale and kind, each well under 50,000 URLs / 50 MB. */
export async function GET() {
  return new Response(sitemapIndexXml(await sitemapChildren()), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': SITEMAP_CACHE_CONTROL },
  })
}
