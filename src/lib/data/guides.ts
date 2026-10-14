import { unstable_cache } from 'next/cache'

import { getPathname } from '@/i18n/navigation'
import { routing, type Locale } from '@/i18n/routing'
import { livePaths } from '@/lib/i18n/published'
import type { Category } from '@/payload-types'

import { getPayload, TAGS } from './payload'

const HOUR = 3600
const published = { _status: { equals: 'published' } } as const

/** Published guides with a title and slug in this locale, newest update first (index page). */
export const getGuides = (locale: Locale) =>
  unstable_cache(
    async () => {
      const res = await (await getPayload()).find({
        collection: 'guides',
        locale,
        where: published,
        sort: '-updatedAt',
        limit: 100,
        depth: 0,
        overrideAccess: false,
        select: { title: true, slug: true, excerpt: true, updatedAt: true },
      })
      return res.docs
        .filter((d) => d.slug && d.title)
        .map((d) => ({ ...d, href: getPathname({ locale, href: { pathname: '/rehber/[slug]', params: { slug: d.slug! } } }) }))
    },
    ['guides', locale],
    { tags: [TAGS.guides], revalidate: HOUR },
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
        .map((c) => ({ name: c.name, href: getPathname({ locale, href: { pathname: '/[category]', params: { category: c.slug! } } }) }))
      return { guide: doc, paths, categories }
    },
    ['guide', locale, slug],
    { tags: [TAGS.guides, TAGS.categories], revalidate: HOUR },
  )()
