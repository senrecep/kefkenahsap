import { unstable_cache } from 'next/cache'

import type { Locale } from '@/i18n/routing'

import { getPayload, TAGS } from './payload'

/** Published `pages` doc whose slug (in `locale`) is one of `slugs`; null → the page falls back to its in-repo template. */
export const getPage = (locale: Locale, slugs: string[]) =>
  unstable_cache(
    async () => {
      const res = await (await getPayload()).find({
        collection: 'pages',
        locale,
        limit: 1,
        depth: 1,
        overrideAccess: false,
        draft: false,
        where: { and: [{ slug: { in: slugs } }, { _status: { equals: 'published' } }] },
      })
      return res.docs[0] ?? null
    },
    ['page', locale, ...slugs],
    { tags: [TAGS.pages], revalidate: 3600 },
  )()
