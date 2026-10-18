import { unstable_cache } from 'next/cache'

import type { Locale } from '@/i18n/routing'

import { getPayload, TAGS } from './payload'

const HOUR = 3600

export const getSiteSettings = (locale: Locale) =>
  unstable_cache(
    async () => (await getPayload()).findGlobal({ slug: 'siteSettings', locale, depth: 1 }),
    ['siteSettings', locale],
    { tags: [TAGS.site], revalidate: HOUR },
  )()

export const getNavCategories = (locale: Locale) =>
  unstable_cache(
    async () => {
      const res = await (await getPayload()).find({
        collection: 'categories',
        locale,
        sort: '_order',
        limit: 50,
        depth: 1,
        // Public read: an unapproved cover comes back as a bare id instead of a populated image.
        overrideAccess: false,
        where: { _status: { equals: 'published' } },
        select: { name: true, slug: true, cover: true, shortDesc: true },
      })
      return res.docs
    },
    ['navCategories', locale],
    { tags: [TAGS.categories], revalidate: HOUR },
  )()
