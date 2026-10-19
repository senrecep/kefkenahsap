import { sitemapDocs } from '@/lib/data/sitemap'
import { siteUrl } from '@/lib/seo/alternates'
import { parseSitemapFile, SITEMAP_CACHE_CONTROL, sitemapEntries, urlsetXml } from '@/lib/seo/sitemap'

// Reads CMS data per request (no DB at build time); the data loaders are tag-cached and the edge keeps the response.
export const dynamic = 'force-dynamic'

/** One child sitemap: `/sitemaps/<locale>-<pages|photos>.xml`, that locale's URLs with every live alternate. */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const child = parseSitemapFile((await params).file)
  if (!child) return new Response('Not found', { status: 404 })
  const entries = sitemapEntries(await sitemapDocs(child.kind), siteUrl(), child.locale)
  return new Response(urlsetXml(entries), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': SITEMAP_CACHE_CONTROL },
  })
}
