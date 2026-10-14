import { unstable_cache } from 'next/cache'

import type { Locale } from '@/i18n/routing'
import { galleryWhere } from '@/lib/gallery/query'
import { homepageQuery } from '@/lib/home/sections'
import type { Where } from 'payload'

import type { Media } from '@/payload-types'

import { getCuratedSelection, mediaQuery, toGalleryItem } from './gallery'
import { markFallbackAlt } from './media-alt'
import { getPayload, TAGS } from './payload'

const HOUR = 3600
// Old watermarked photos vary a lot; defaults only use large landscape ones.
const LARGE_LANDSCAPE = 1280

export const getHomepage = (locale: Locale) =>
  unstable_cache(
    async () => (await getPayload()).findGlobal({ ...homepageQuery, locale }),
    ['homepage', locale],
    { tags: [TAGS.homepage, TAGS.media], revalidate: HOUR },
  )()

/** Hero photo when the admin has not picked one: first featured, else first Deck ve Zeminler image — large and landscape. */
export const getHeroFallback = (locale: Locale) =>
  unstable_cache(
    async () => {
      const payload = await getPayload()
      const deck = await payload.find({ collection: 'categories', locale: 'tr', where: { slug: { equals: 'deck-ve-zeminler' } }, limit: 1, depth: 0, overrideAccess: false, select: { slug: true } })
      const passes: Where[] = [{ featured: { equals: true } }, ...(deck.docs[0] ? [{ category: { equals: deck.docs[0].id } }] : []), {}]
      for (const extra of passes) {
        const res = await payload.find({
          collection: 'media',
          locale,
          ...mediaQuery,
          where: { and: [...galleryWhere({}).and, { width: { greater_than_equal: LARGE_LANDSCAPE } }, extra] },
          sort: 'id',
          limit: 20,
        })
        const doc = (res.docs as Media[]).find((d) => (d.width ?? 0) > (d.height ?? 0))
        if (doc) return toGalleryItem((await markFallbackAlt(payload, locale, [doc]))[0]!, locale)
      }
      return null
    },
    ['heroFallback', locale],
    { tags: [TAGS.media, TAGS.categories], revalidate: HOUR },
  )()

/** Homepage gallery: the head of the curated selection the unfiltered /galeri also opens with. */
export const getFeaturedImages = async (locale: Locale, limit: number) => (await getCuratedSelection(locale)).slice(0, limit)

export const getFeaturedProjects = (locale: Locale) =>
  unstable_cache(
    async () => {
      const res = await (await getPayload()).find({
        collection: 'projects',
        locale,
        draft: false,
        overrideAccess: false,
        where: { and: [{ _status: { equals: 'published' } }, { featured: { equals: true } }] },
        sort: '-updatedAt',
        limit: 6,
        depth: 1,
        select: { title: true, slug: true, cover: true, city: true, year: true },
      })
      return res.docs.filter((p) => p.slug && p.title)
    },
    ['featuredProjects', locale],
    { tags: [TAGS.projects, TAGS.media], revalidate: HOUR },
  )()

export const getReferences = (locale: Locale) =>
  unstable_cache(
    async () => {
      const res = await (await getPayload()).find({ collection: 'references', locale, sort: 'name', limit: 50, depth: 0, overrideAccess: false, select: { name: true, location: true } })
      return res.docs
    },
    ['references', locale],
    { tags: [TAGS.references], revalidate: HOUR },
  )()
