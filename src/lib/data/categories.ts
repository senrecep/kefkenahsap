import { unstable_cache } from 'next/cache'

import { routing, type Locale } from '@/i18n/routing'
import { pickCover } from '@/lib/gallery/curate'
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
      // Every locale's slug + name of the same document: the input for livePaths (dil yayında rule).
      const all = (await payload.findByID({
        collection: 'categories',
        id: doc.id,
        locale: 'all',
        depth: 0,
        select: { slug: true, name: true },
      })) as unknown as { slug?: Record<string, string | null>; name?: Record<string, string | null> }
      const locales = Object.fromEntries(Object.keys(all.slug ?? {}).map((l) => [l, { slug: all.slug?.[l], title: all.name?.[l] }]))
      const photos = (doc.media?.docs ?? []).filter((m): m is Media => typeof m === 'object')
      return { category: doc, photos, hasMore: Boolean(doc.media?.hasNextPage), locales }
    },
    ['category', locale, slug, String(limit)],
    { tags: [TAGS.categories, TAGS.media], revalidate: HOUR },
  )()

/** Service tiles (home + /hizmetlerimiz): every published category with its cover, else its first large landscape photo in the saved order. */
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
        // Large photos only (landscape is not expressible as a filter; pickCover checks it).
        joins: { media: { limit: 100, where: { and: [approved, { width: { greater_than_equal: 1280 } }] } } },
        select: { name: true, slug: true, shortDesc: true, cover: true, media: true },
      })
      return res.docs
        .filter((c) => c.slug)
        .map((c) => {
          const photos = (c.media?.docs ?? []).filter((m): m is Media => typeof m === 'object')
          return { id: c.id, name: c.name, slug: c.slug!, shortDesc: c.shortDesc, image: pickCover(c.cover, photos) }
        })
    },
    ['serviceTiles', locale],
    { tags: [TAGS.categories, TAGS.media], revalidate: HOUR },
  )()

/** Locales with at least one live service (dil-yayında: slug + name), plus the default: the input for fixedRoutePaths. */
export const getContentLocales = async () => {
  const live = await Promise.all(
    routing.locales.map(async (l) => l === routing.defaultLocale || (await getServiceTiles(l)).some((c) => c.name?.trim())),
  )
  return routing.locales.filter((_, i) => live[i])
}
