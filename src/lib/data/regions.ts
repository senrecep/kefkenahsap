import { unstable_cache } from 'next/cache'

import { getPathname } from '@/i18n/navigation'
import { routing, type Locale } from '@/i18n/routing'
import { regionGate } from '@/lib/regions/gate'
import type { SitemapDoc } from '@/lib/seo/sitemap'
import type { Media } from '@/payload-types'

import { getPayload, TAGS } from './payload'
import { card } from './projects'

const HOUR = 3600
const published = { _status: { equals: 'published' } } as const
const isApproved = (m: unknown): m is Media => typeof m === 'object' && m !== null && (m as Media).status === 'approved'
const regionPath = (locale: Locale, slug: string) => getPathname({ locale, href: { pathname: '/bolgeler/[slug]', params: { slug } } })

/**
 * Every published region live in this locale (name + slug), with its publish-gate verdict. The one source for the
 * page's hreflang/noindex, the sitemap and the footer list, so they cannot disagree. A project counts in a locale
 * when it shows there (own slug + title, no locale fallback).
 * shortcut: loads every region body to count words, fine for tens of regions; store a word count past ~200.
 */
export const getRegions = (locale: Locale) =>
  unstable_cache(
    async () => {
      const payload = await getPayload()
      const [regions, projects] = await Promise.all([
        payload.find({ collection: 'regions', locale, where: published, pagination: false, depth: 0, overrideAccess: false, select: { name: true, slug: true, body: true, updatedAt: true } }),
        payload.find({
          collection: 'projects',
          locale,
          where: { and: [published, { region: { exists: true } }] },
          pagination: false,
          depth: 0,
          overrideAccess: false,
          select: { slug: true, title: true, region: true },
        }),
      ])
      const counts = new Map<number, number>()
      for (const p of projects.docs) if (p.slug && p.title && typeof p.region === 'number') counts.set(p.region, (counts.get(p.region) ?? 0) + 1)
      return regions.docs
        .filter((r) => r.slug && r.name)
        .map((r) => ({
          id: r.id,
          name: r.name,
          updatedAt: r.updatedAt,
          href: regionPath(locale, r.slug!),
          indexable: regionGate({ projects: counts.get(r.id) ?? 0, body: r.body }).indexable,
        }))
    },
    ['regions', locale],
    { tags: [TAGS.regions, TAGS.projects], revalidate: HOUR },
  )()

/** Per-locale path of a region where it is live AND passes the gate, else null (→ noindex, no hreflang, not in the sitemap). */
const gatedPaths = async (id: number) =>
  Object.fromEntries(await Promise.all(routing.locales.map(async (l) => [l, (await getRegions(l)).find((r) => r.id === id && r.indexable)?.href ?? null] as const)))

/** Published region by localized slug: its projects as cards, their approved photos, and the gated paths. */
export const getRegion = (locale: Locale, slug: string) =>
  unstable_cache(
    async () => {
      const payload = await getPayload()
      const region = (await payload.find({ collection: 'regions', locale, where: { and: [published, { slug: { equals: slug } }] }, limit: 1, depth: 0, overrideAccess: false })).docs[0]
      if (!region?.name) return null
      const projects = await payload.find({
        collection: 'projects',
        locale,
        where: { and: [published, { region: { equals: region.id } }] },
        sort: ['-year', '-createdAt'],
        pagination: false,
        depth: 1,
        select: { title: true, slug: true, city: true, district: true, year: true, cover: true, gallery: true, categories: true },
      })
      const shown = projects.docs.filter((p) => p.slug && p.title)
      const photos = [...new Map(shown.flatMap((p) => (p.gallery ?? []).filter(isApproved)).map((m) => [m.id, m])).values()]
      return { region, cards: shown.map(card), photos, paths: await gatedPaths(region.id) }
    },
    ['region', locale, slug],
    { tags: [TAGS.regions, TAGS.projects, TAGS.media], revalidate: HOUR },
  )()

/** Sitemap documents for regions: only the locales where the region passes the gate. */
export async function getRegionSitemapDocs(): Promise<SitemapDoc[]> {
  const byId = new Map<number, SitemapDoc>()
  for (const l of routing.locales) {
    for (const r of await getRegions(l)) {
      const doc = byId.get(r.id) ?? { paths: Object.fromEntries(routing.locales.map((x) => [x, null])), lastModified: r.updatedAt }
      if (r.indexable) doc.paths[l] = r.href
      byId.set(r.id, doc)
    }
  }
  return [...byId.values()]
}
