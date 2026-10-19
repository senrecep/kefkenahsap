import { type APIRequestContext, expect } from '@playwright/test'

/** The child sitemaps the index at /sitemap.xml lists: their paths and XML. */
export async function sitemapChildren(request: APIRequestContext): Promise<{ path: string; xml: string; cacheControl?: string }[]> {
  const index = await request.get('/sitemap.xml')
  expect(index.status()).toBe(200)
  const locs = [...(await index.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]!).pathname)
  return Promise.all(
    locs.map(async (path) => {
      const res = await request.get(path)
      expect(res.status(), path).toBe(200)
      return { path, xml: await res.text(), cacheControl: res.headers()['cache-control'] }
    }),
  )
}

/** Every child sitemap's XML joined: what one /sitemap.xml held before the split. */
export const sitemapText = async (request: APIRequestContext) => (await sitemapChildren(request)).map((c) => c.xml).join('\n')
