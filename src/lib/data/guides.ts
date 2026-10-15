import { unstable_cache } from 'next/cache'

import { getPathname } from '@/i18n/navigation'
import { routing, type Locale } from '@/i18n/routing'
import { livePaths } from '@/lib/i18n/published'
import type { Category, Media } from '@/payload-types'

import { getServiceTiles } from './categories'
import { withDefaultAlt } from './media-alt'
import { getPayload, TAGS } from './payload'

const HOUR = 3600
const published = { _status: { equals: 'published' } } as const
const isApproved = (m: unknown): m is Media => typeof m === 'object' && m !== null && (m as Media).status === 'approved'
const idOf = (c: number | Category) => (typeof c === 'object' ? c.id : c)

/**
 * Published guides with a title and slug in this locale, newest update first (index page, related guides). `image` is the
 * guide's approved cover, else the photo of its first related service (the service tile's), else the first service photo.
 */
export const getGuides = (locale: Locale) =>
  unstable_cache(
    async () => {
      const res = await (await getPayload()).find({
        collection: 'guides',
        locale,
        where: published,
        sort: '-updatedAt',
        limit: 100,
        depth: 1,
        // dil-yayında: a guide is listed only with its own title and slug here, never the default locale's.
        fallbackLocale: false,
        overrideAccess: false,
        select: { title: true, slug: true, excerpt: true, updatedAt: true, cover: true, relatedCategories: true },
        populate: { categories: { slug: true } },
      })
      const payload = await getPayload()
      const serviceTiles = await getServiceTiles(locale)
      const tiles = new Map(serviceTiles.map((t) => [t.id, t.image]))
      // Last resort, so a tile is never blank: the first service photo (a guide with no cover and no related service).
      const anyPhoto = serviceTiles.map((t) => t.image).find(Boolean)
      const docs = res.docs.filter((d) => d.slug?.trim() && d.title?.trim())
      const images = await withDefaultAlt(
        payload,
        locale,
        docs.map((d) => (isApproved(d.cover) ? d.cover : ((d.relatedCategories ?? []).map((c) => tiles.get(idOf(c))).find(Boolean) ?? anyPhoto))).filter(isApproved),
      )
      const imageById = new Map(images.map((m) => [m.id, m]))
      return docs.map((d) => {
        const categories = (d.relatedCategories ?? []).map(idOf)
        const own = isApproved(d.cover) ? d.cover : (categories.map((c) => tiles.get(c)).find(Boolean) ?? anyPhoto)
        return {
          id: d.id,
          title: d.title,
          excerpt: d.excerpt,
          updatedAt: d.updatedAt,
          categories,
          image: own ? imageById.get(own.id) : undefined,
          href: getPathname({ locale, href: { pathname: '/rehber/[slug]', params: { slug: d.slug! } } }),
        }
      })
    },
    ['guides', locale],
    { tags: [TAGS.guides, TAGS.categories, TAGS.media], revalidate: HOUR },
  )()

/** One published guide + its path per locale (null where that locale has no slug/title → no hreflang). */
export const getGuide = (locale: Locale, slug: string) =>
  unstable_cache(
    async () => {
      const payload = await getPayload()
      const res = await payload.find({ collection: 'guides', locale, where: { and: [published, { slug: { equals: slug } }] }, limit: 1, depth: 1, overrideAccess: false })
      const doc = res.docs[0]
      if (!doc?.title) return null
      const all = await payload.find({ collection: 'guides', locale: 'all', where: { id: { equals: doc.id } }, limit: 1, depth: 0, overrideAccess: false, select: { slug: true, title: true } })
      const loc = all.docs[0] as unknown as { slug?: Record<string, string | null>; title?: Record<string, string | null> } | undefined
      // dil-yayında: a locale is live only with both its own slug and title.
      const paths = livePaths(
        Object.fromEntries(routing.locales.map((l) => [l, { slug: loc?.slug?.[l], title: loc?.title?.[l] }])),
        (l, s) => getPathname({ locale: l as Locale, href: { pathname: '/rehber/[slug]', params: { slug: s } } }),
      )
      const categories = (doc.relatedCategories ?? [])
        .filter((c): c is Category => typeof c === 'object' && c._status === 'published' && Boolean(c.slug && c.name))
        .map((c) => ({ id: c.id, name: c.name, href: getPathname({ locale, href: { pathname: '/[category]', params: { category: c.slug! } } }) }))
      const [cover] = await withDefaultAlt(payload, locale, isApproved(doc.cover) ? [doc.cover] : [])
      return { guide: doc, paths, categories, cover }
    },
    ['guide', locale, slug],
    { tags: [TAGS.guides, TAGS.categories, TAGS.media], revalidate: HOUR },
  )()

/** Of these gallery slugs (SEO filenames), the ones that are approved photos: a link to /galeri/<slug> must not 404. */
export const getApprovedPhotoSlugs = (slugs: string[]) =>
  unstable_cache(
    async () => {
      const res = await (await getPayload()).find({
        collection: 'media',
        where: { and: [{ seoFilename: { in: slugs } }, { status: { equals: 'approved' } }] },
        limit: slugs.length,
        depth: 0,
        overrideAccess: false,
        select: { seoFilename: true },
      })
      return res.docs.map((d) => d.seoFilename).filter((s): s is string => Boolean(s))
    },
    ['approvedPhotoSlugs', ...slugs],
    { tags: [TAGS.media], revalidate: HOUR },
  )()
