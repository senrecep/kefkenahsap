import { unstable_cache } from 'next/cache'

import type { Locale } from '@/i18n/routing'
import type { Media } from '@/payload-types'

import { getPayload, TAGS } from './payload'

const HOUR = 3600
// The local API bypasses collection access, so public filters are explicit here.
const published = { _status: { equals: 'published' } } as const
const approved = { status: { equals: 'approved' } } as const

/** Published category by its localized slug, with the first `limit` approved photos in the saved order. */
export const getCategory = (locale: Locale, slug: string, limit: number) =>
  unstable_cache(
    async () => {
      const payload = await getPayload()
      const res = await payload.find({
        collection: 'categories',
        locale,
        depth: 1,
        limit: 1,
        where: { and: [published, { slug: { equals: slug } }] },
        joins: { media: { limit, where: approved } },
      })
      const doc = res.docs[0]
      if (!doc) return null
      // Every locale's slug + name of the same document, for hreflang alternates and the language switcher.
      const all = (await payload.findByID({
        collection: 'categories',
        id: doc.id,
        locale: 'all',
        depth: 0,
        select: { slug: true, name: true },
      })) as unknown as { slug?: Record<string, string | null>; name?: Record<string, string | null> }
      const slugs: Record<string, string> = {}
      for (const [l, s] of Object.entries(all.slug ?? {})) if (s && all.name?.[l]) slugs[l] = s
      const photos = (doc.media?.docs ?? []).filter((m): m is Media => typeof m === 'object')
      return { category: doc, photos, hasMore: Boolean(doc.media?.hasNextPage), slugs }
    },
    ['category', locale, slug, String(limit)],
    { tags: [TAGS.categories, TAGS.media], revalidate: HOUR },
  )()

/** Service tiles: every published category with its cover, else its first approved photo. */
export const getServiceTiles = (locale: Locale) =>
  unstable_cache(
    async () => {
      const res = await (await getPayload()).find({
        collection: 'categories',
        locale,
        sort: '_order',
        limit: 50,
        depth: 1,
        where: published,
        joins: { media: { limit: 1, where: approved } },
        select: { name: true, slug: true, shortDesc: true, cover: true, media: true },
      })
      return res.docs
        .filter((c) => c.slug)
        .map((c) => {
          const cover = typeof c.cover === 'object' && c.cover?.status === 'approved' ? c.cover : undefined
          const first = c.media?.docs?.[0]
          return { id: c.id, name: c.name, slug: c.slug!, shortDesc: c.shortDesc, image: cover ?? (typeof first === 'object' ? first : undefined) }
        })
    },
    ['serviceTiles', locale],
    { tags: [TAGS.categories, TAGS.media], revalidate: HOUR },
  )()

/** Published projects tagged with this category (newest first). */
export const getCategoryProjects = (locale: Locale, categoryId: number, limit = 6) =>
  unstable_cache(
    async () => {
      const res = await (await getPayload()).find({
        collection: 'projects',
        locale,
        depth: 1,
        limit,
        sort: '-year',
        where: { and: [published, { categories: { contains: categoryId } }] },
        select: { title: true, slug: true, cover: true, city: true, district: true, year: true },
      })
      return res.docs.filter((p) => p.slug)
    },
    ['categoryProjects', locale, String(categoryId), String(limit)],
    { tags: [TAGS.projects, TAGS.media], revalidate: HOUR },
  )()
