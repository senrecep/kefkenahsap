import type { MetadataRoute } from 'next'

import { buildAlternates } from './alternates'

export type SitemapDoc = {
  /** Path per locale; null/undefined where the translation is not live (that URL is noindex, so not listed). */
  paths: Record<string, string | null | undefined>
  lastModified?: string | null
  images?: string[]
}

/** PLAN §7 Teknik 8: only indexable URLs, each with its language alternates; images use the image-sitemap extension. */
export function sitemapEntries(docs: SitemapDoc[], site: string): MetadataRoute.Sitemap {
  return docs.flatMap((d) => {
    const { languages } = buildAlternates({ current: '', paths: d.paths, site })
    return Object.keys(d.paths)
      .filter((l) => d.paths[l])
      .map((l) => ({
        url: languages[l]!,
        ...(d.lastModified ? { lastModified: d.lastModified } : {}),
        alternates: { languages },
        ...(d.images?.length ? { images: d.images } : {}),
      }))
  })
}
